package handlers

import (
	"encoding/json"
	"fmt"

	"github.com/authelia/authelia/v4/internal/middlewares"
	"github.com/authelia/authelia/v4/internal/regulation"
	"github.com/authelia/authelia/v4/internal/session"
	"github.com/authelia/authelia/v4/internal/utils"
)

func TOTPRegisterOptionsGET(ctx *middlewares.AutheliaCtx) {
	if err := ctx.SetJSONBody(ctx.Providers.TOTP.Options()); err != nil {
		ctx.Logger.Errorf("Unable to set TOTP options response in body: %s", err)
	}
}

func TOTPRegisterPUT(ctx *middlewares.AutheliaCtx) {
	var (
		userSession session.UserSession
		bodyJSON    bodyRegisterTOTP
		err         error
	)

	if userSession, err = ctx.GetSession(); err != nil {
		ctx.Logger.WithError(err).Errorf("Error occurred retrieving session for %s registration", regulation.AuthTypeTOTP)

		respondUnauthorized(ctx, messageUnableToRegisterOneTimePassword)

		return
	}

	if err = json.Unmarshal(ctx.PostBody(), &bodyJSON); err != nil {
		ctx.Logger.WithError(err).Errorf("Error occurred unmarshaling body %s registration", regulation.AuthTypeTOTP)

		respondUnauthorized(ctx, messageUnableToRegisterOneTimePassword)

		return
	}

	opts := ctx.Providers.TOTP.Options()

	var hasAlgorithm, hasLength, hasPeriod bool

	hasAlgorithm = utils.IsStringInSlice(bodyJSON.Algorithm, opts.Algorithms)

	for _, period := range opts.Periods {
		if period == bodyJSON.Period {
			hasPeriod = true
			break
		}
	}

	for _, length := range opts.Lengths {
		if length == bodyJSON.Length {
			hasLength = true
			break
		}
	}

	if !hasAlgorithm || !hasPeriod || !hasLength {
		ctx.Logger.Errorf("Validation failed for %s registration because the input options were not permitted by the configuration", regulation.AuthTypeTOTP)

		respondUnauthorized(ctx, messageUnableToRegisterOneTimePassword)

		return
	}

	if userSession.TOTP, err = ctx.Providers.TOTP.GenerateCustom(userSession.Username, bodyJSON.Algorithm, "", uint(bodyJSON.Length), uint(bodyJSON.Period), 0); err != nil {
		ctx.Error(fmt.Errorf("unable to generate TOTP key: %w", err), messageUnableToRegisterOneTimePassword)

		respondUnauthorized(ctx, messageUnableToRegisterOneTimePassword)

		return
	}

	if err = ctx.SaveSession(userSession); err != nil {
		ctx.Error(err, messageUnableToRegisterOneTimePassword)

		respondUnauthorized(ctx, messageUnableToRegisterOneTimePassword)

		return
	}

	response := TOTPKeyResponse{
		OTPAuthURL:   userSession.TOTP.URI(),
		Base32Secret: string(userSession.TOTP.Secret),
	}

	if err = ctx.SetJSONBody(response); err != nil {
		ctx.Logger.Errorf("Unable to set TOTP key response in body: %s", err)
	}
}
