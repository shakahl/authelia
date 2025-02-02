package commands

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"

	"github.com/fsnotify/fsnotify"
	"github.com/sirupsen/logrus"
	"github.com/valyala/fasthttp"
	"golang.org/x/sync/errgroup"

	"github.com/authelia/authelia/v4/internal/authentication"
	"github.com/authelia/authelia/v4/internal/server"
)

// NewServerService creates a new ServerService with the appropriate logger etc.
func NewServerService(name string, server *fasthttp.Server, listener net.Listener, paths []string, isTLS bool, log *logrus.Logger) (service *ServerService) {
	return &ServerService{
		server:   server,
		listener: listener,
		paths:    paths,
		isTLS:    isTLS,
		log:      log.WithFields(map[string]any{"service": "server", "server": name}),
	}
}

// NewFileWatcherService creates a new FileWatcherService with the appropriate logger etc.
func NewFileWatcherService(name, path string, reload ProviderReload, log *logrus.Logger) (service *FileWatcherService, err error) {
	if path == "" {
		return nil, fmt.Errorf("path must be specified")
	}

	var info os.FileInfo

	if info, err = os.Stat(path); err != nil {
		return nil, fmt.Errorf("error stating file '%s': %w", path, err)
	}

	if path, err = filepath.Abs(path); err != nil {
		return nil, fmt.Errorf("error determining absolute path of file '%s': %w", path, err)
	}

	var watcher *fsnotify.Watcher

	if watcher, err = fsnotify.NewWatcher(); err != nil {
		return nil, err
	}

	entry := log.WithFields(map[string]any{"service": "watcher", "watcher": name})

	if info.IsDir() {
		service = &FileWatcherService{
			watcher:   watcher,
			reload:    reload,
			log:       entry,
			directory: filepath.Clean(path),
		}
	} else {
		service = &FileWatcherService{
			watcher:   watcher,
			reload:    reload,
			log:       entry,
			directory: filepath.Dir(path),
			file:      filepath.Base(path),
		}
	}

	if err = service.watcher.Add(service.directory); err != nil {
		return nil, fmt.Errorf("failed to add path '%s' to watch list: %w", path, err)
	}

	return service, nil
}

// ProviderReload represents the required methods to support reloading a provider.
type ProviderReload interface {
	Reload() (reloaded bool, err error)
}

// Service represents the required methods to support handling a service.
type Service interface {
	Run() (err error)
	Shutdown()
}

// ServerService is a Service which runs a webserver.
type ServerService struct {
	server   *fasthttp.Server
	paths    []string
	isTLS    bool
	listener net.Listener
	log      *logrus.Entry
}

// Run the ServerService.
func (service *ServerService) Run() (err error) {
	defer func() {
		if r := recover(); r != nil {
			service.log.WithError(recoverErr(r)).Error("Critical error caught (recovered)")
		}
	}()

	service.log.Infof(fmtLogServerListening, connectionType(service.isTLS), service.listener.Addr().String(), strings.Join(service.paths, "' and '"))

	if err = service.server.Serve(service.listener); err != nil {
		service.log.WithError(err).Error("Error returned attempting to serve requests")

		return err
	}

	return nil
}

// Shutdown the ServerService.
func (service *ServerService) Shutdown() {
	if err := service.server.Shutdown(); err != nil {
		service.log.WithError(err).Error("Error occurred during shutdown")
	}
}

// FileWatcherService is a Service that watches files for changes.
type FileWatcherService struct {
	watcher *fsnotify.Watcher
	reload  ProviderReload

	log       *logrus.Entry
	file      string
	directory string
}

// Run the FileWatcherService.
func (service *FileWatcherService) Run() (err error) {
	defer func() {
		if r := recover(); r != nil {
			service.log.WithError(recoverErr(r)).Error("Critical error caught (recovered)")
		}
	}()

	service.log.WithField("file", filepath.Join(service.directory, service.file)).Info("Watching for file changes to the file")

	for {
		select {
		case event, ok := <-service.watcher.Events:
			if !ok {
				return nil
			}

			if service.file != "" && service.file != filepath.Base(event.Name) {
				service.log.WithFields(map[string]any{"file": event.Name, "op": event.Op}).Tracef("File modification detected to irrelevant file")
				break
			}

			switch {
			case event.Op&fsnotify.Write == fsnotify.Write, event.Op&fsnotify.Create == fsnotify.Create:
				service.log.WithFields(map[string]any{"file": event.Name, "op": event.Op}).Debug("File modification was detected")

				var reloaded bool

				switch reloaded, err = service.reload.Reload(); {
				case err != nil:
					service.log.WithFields(map[string]any{"file": event.Name, "op": event.Op}).WithError(err).Error("Error occurred during reload")
				case reloaded:
					service.log.WithField("file", event.Name).Info("Reloaded successfully")
				default:
					service.log.WithField("file", event.Name).Debug("Reload of was triggered but it was skipped")
				}
			case event.Op&fsnotify.Remove == fsnotify.Remove:
				service.log.WithFields(map[string]any{"file": event.Name, "op": event.Op}).Debug("File remove was detected")
			}
		case err, ok := <-service.watcher.Errors:
			if !ok {
				return nil
			}

			service.log.WithError(err).Errorf("Error while watching files")
		}
	}
}

// Shutdown the FileWatcherService.
func (service *FileWatcherService) Shutdown() {
	if err := service.watcher.Close(); err != nil {
		service.log.WithError(err).Error("Error occurred during shutdown")
	}
}

func svcSvrMainFunc(ctx *CmdCtx) (service Service) {
	switch svr, listener, paths, isTLS, err := server.CreateDefaultServer(ctx.config, ctx.providers); {
	case err != nil:
		ctx.log.WithError(err).Fatal("Create Server Service (main) returned error")
	case svr != nil && listener != nil:
		service = NewServerService("main", svr, listener, paths, isTLS, ctx.log)
	default:
		ctx.log.Fatal("Create Server Service (main) failed")
	}

	return service
}

func svcSvrMetricsFunc(ctx *CmdCtx) (service Service) {
	switch svr, listener, paths, isTLS, err := server.CreateMetricsServer(ctx.config, ctx.providers); {
	case err != nil:
		ctx.log.WithError(err).Fatal("Create Server Service (metrics) returned error")
	case svr != nil && listener != nil:
		service = NewServerService("metrics", svr, listener, paths, isTLS, ctx.log)
	default:
		ctx.log.Debug("Create Server Service (metrics) skipped")
	}

	return service
}

func svcWatcherUsersFunc(ctx *CmdCtx) (service Service) {
	var err error

	if ctx.config.AuthenticationBackend.File != nil && ctx.config.AuthenticationBackend.File.Watch {
		provider := ctx.providers.UserProvider.(*authentication.FileUserProvider)

		if service, err = NewFileWatcherService("users", ctx.config.AuthenticationBackend.File.Path, provider, ctx.log); err != nil {
			ctx.log.WithError(err).Fatal("Create Watcher Service (users) returned error")
		}
	}

	return service
}

func connectionType(isTLS bool) string {
	if isTLS {
		return "TLS"
	}

	return "non-TLS"
}

func servicesRun(ctx *CmdCtx) {
	cctx, cancel := context.WithCancel(ctx)

	group, cctx := errgroup.WithContext(cctx)

	defer cancel()

	quit := make(chan os.Signal, 1)

	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	defer signal.Stop(quit)

	var (
		services []Service
	)

	for _, serviceFunc := range []func(ctx *CmdCtx) Service{
		svcSvrMainFunc, svcSvrMetricsFunc,
		svcWatcherUsersFunc,
	} {
		if service := serviceFunc(ctx); service != nil {
			services = append(services, service)

			group.Go(service.Run)
		}
	}

	ctx.log.Info("Startup Complete")

	select {
	case s := <-quit:
		switch s {
		case syscall.SIGINT:
			ctx.log.WithField("signal", "SIGINT").Debugf("Shutdown started due to signal")
		case syscall.SIGTERM:
			ctx.log.WithField("signal", "SIGTERM").Debugf("Shutdown started due to signal")
		}
	case <-cctx.Done():
		ctx.log.Debugf("Shutdown started due to context completion")
	}

	cancel()

	ctx.log.Infof("Shutting down")

	wgShutdown := &sync.WaitGroup{}

	for _, service := range services {
		go func() {
			service.Shutdown()

			wgShutdown.Done()
		}()

		wgShutdown.Add(1)
	}

	wgShutdown.Wait()

	var err error

	if err = ctx.providers.StorageProvider.Close(); err != nil {
		ctx.log.WithError(err).Error("Error occurred closing database connections")
	}

	if err = group.Wait(); err != nil {
		ctx.log.WithError(err).Errorf("Error occurred waiting for shutdown")
	}
}
