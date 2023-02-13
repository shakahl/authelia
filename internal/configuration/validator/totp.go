package validator

import (
	"fmt"
	"strings"

	"github.com/authelia/authelia/v4/internal/configuration/schema"
	"github.com/authelia/authelia/v4/internal/utils"
)

// ValidateTOTP validates and update TOTP configuration.
func ValidateTOTP(config *schema.Configuration, validator *schema.StructValidator) {
	if config.TOTP.Disable {
		return
	}

	if config.TOTP.Issuer == "" {
		config.TOTP.Issuer = schema.DefaultTOTPConfiguration.Issuer
	}

	if config.TOTP.DefaultAlgorithm == "" {
		config.TOTP.DefaultAlgorithm = schema.DefaultTOTPConfiguration.DefaultAlgorithm
	} else {
		config.TOTP.DefaultAlgorithm = strings.ToUpper(config.TOTP.DefaultAlgorithm)

		if !utils.IsStringInSlice(config.TOTP.DefaultAlgorithm, schema.TOTPPossibleAlgorithms) {
			validator.Push(fmt.Errorf(errFmtTOTPInvalidAlgorithm, strings.Join(schema.TOTPPossibleAlgorithms, "', '"), config.TOTP.DefaultAlgorithm))
		}
	}

	if config.TOTP.DefaultPeriod == 0 {
		config.TOTP.DefaultPeriod = schema.DefaultTOTPConfiguration.DefaultPeriod
	} else if config.TOTP.DefaultPeriod < 15 {
		validator.Push(fmt.Errorf(errFmtTOTPInvalidPeriod, config.TOTP.DefaultPeriod))
	}

	if config.TOTP.DefaultDigits == 0 {
		config.TOTP.DefaultDigits = schema.DefaultTOTPConfiguration.DefaultDigits
	} else if config.TOTP.DefaultDigits != 6 && config.TOTP.DefaultDigits != 8 {
		validator.Push(fmt.Errorf(errFmtTOTPInvalidDigits, config.TOTP.DefaultDigits))
	}

	if config.TOTP.Skew == nil {
		config.TOTP.Skew = schema.DefaultTOTPConfiguration.Skew
	}

	if config.TOTP.SecretSize == 0 {
		config.TOTP.SecretSize = schema.DefaultTOTPConfiguration.SecretSize
	} else if config.TOTP.SecretSize < schema.TOTPSecretSizeMinimum {
		validator.Push(fmt.Errorf(errFmtTOTPInvalidSecretSize, schema.TOTPSecretSizeMinimum, config.TOTP.SecretSize))
	}
}
