import React, { Fragment, MutableRefObject, useCallback, useEffect, useRef, useState } from "react";

import { faCopy, faKey, faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormLabel,
    Grid,
    Link,
    Paper,
    Radio,
    RadioGroup,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Theme,
    Typography,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import classnames from "classnames";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";

import AppStoreBadges from "@components/AppStoreBadges";
import { GoogleAuthenticator } from "@constants/constants";
import { useNotifications } from "@hooks/NotificationsContext";
import { TOTPOptions, toAlgorithmString } from "@models/TOTPConfiguration";
import { WebauthnTouchState } from "@models/Webauthn";
import { completeTOTPRegistrationProcess, getTOTPSecret } from "@services/RegisterDevice";
import { getTOTPOptions } from "@services/UserInfoTOTPConfiguration";

const steps = ["Start", "Scan QR Code", "Confirmation"];

interface Props {
    open: boolean;
    onClose: () => void;
    setCancelled: () => void;
}

export default function TOTPRegisterDialog(props: Props) {
    const { t: translate } = useTranslation("settings");

    const styles = useStyles();
    const { createErrorNotification } = useNotifications();

    const [activeStep, setActiveStep] = useState(0);
    const [options, setOptions] = useState<TOTPOptions | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [optionAlgorithm, setOptionAlgorithm] = useState("");
    const [optionLength, setOptionLength] = useState("6");
    const [optionPeriod, setOptionPeriod] = useState("30");
    const [optionAlgorithms, setOptionAlgorithms] = useState<string[]>([]);
    const [optionLengths, setOptionLengths] = useState<string[]>([]);
    const [optionPeriods, setOptionPeriods] = useState<string[]>([]);
    const [totpSecretURL, setTOTPSecretURL] = useState("");
    const [totpSecretBase32, setTOTPSecretBase32] = useState<string | undefined>(undefined);
    const [totpIsLoading, setTOTPIsLoading] = useState(false);
    const [hasErrored, setHasErrored] = useState(false);

    const nameRef = useRef() as MutableRefObject<HTMLInputElement>;
    const [nameError, setNameError] = useState(false);

    const resetStates = () => {
        setActiveStep(0);
        setOptions(null);
        setShowAdvanced(false);
        setOptionAlgorithm("");
        setOptionLength("6");
        setOptionPeriod("30");
        setOptionAlgorithms([]);
        setOptionLengths([]);
        setOptionPeriods([]);
        setTOTPSecretURL("");
        setTOTPSecretBase32(undefined);
        setTOTPIsLoading(false);
    };

    const handleClose = useCallback(() => {
        resetStates();

        props.setCancelled();
    }, [props]);

    useEffect(() => {
        (async () => {
            const opts = await getTOTPOptions();

            setOptionAlgorithm(toAlgorithmString(opts.algorithm));
            setOptionAlgorithms(opts.algorithms.map((algorithm) => toAlgorithmString(algorithm)));
            setOptionLength(opts.length.toString());
            setOptionLengths(opts.lengths.map((length) => length.toString()));
            setOptionPeriod(opts.period.toString());
            setOptionPeriods(opts.periods.map((period) => period.toString()));
        })();
    }, [props.open, activeStep]);

    const handleGetTOTPDetails = useCallback(async () => {
        if (!props.open || activeStep !== 1) {
            return;
        }

        setTOTPIsLoading(true);

        try {
            const secret = await getTOTPSecret(optionAlgorithm, parseInt(optionLength), parseInt(optionPeriod));
            setTOTPSecretURL(secret.otpauth_url);
            setTOTPSecretBase32(secret.base32_secret);
        } catch (err) {
            console.error(err);
            if ((err as Error).message.includes("Request failed with status code 403")) {
                createErrorNotification(
                    translate(
                        "You must open the link from the same device and browser that initiated the registration process",
                    ),
                );
            } else {
                createErrorNotification(
                    translate("Failed to register device, the provided link is expired or has already been used"),
                );
            }
            setHasErrored(true);
        }

        setTOTPIsLoading(false);
    }, [activeStep, createErrorNotification, optionAlgorithm, optionLength, optionPeriod, props.open, translate]);

    useEffect(() => {
        if (!props.open || activeStep !== 1) {
            return;
        }

        handleGetTOTPDetails();
    }, [createErrorNotification, translate]);

    const toggleAdvanced = () => {
        setShowAdvanced((prevState) => !prevState);
    };

    const advanced =
        options !== null &&
        (options.algorithms.length !== 1 || options.algorithms.length !== 1 || options.periods.length !== 1);

    const hideAdvanced =
        options === null ||
        (options.algorithms.length <= 1 && options.algorithms.length <= 1 && options.periods.length <= 1);
    const hideAlgorithms = advanced && options?.algorithms.length <= 1;
    const hideLengths = advanced && options?.lengths.length <= 1;
    const hidePeriods = advanced && options?.periods.length <= 1;
    const qrcodeFuzzyStyle = totpIsLoading || hasErrored ? styles.fuzzy : undefined;

    function renderStep(step: number) {
        switch (step) {
            case 0:
                return (
                    <Fragment>
                        {options === null ? null : (
                            <FormControl>
                                <Button variant={"outlined"} color={"primary"}>
                                    {translate("Start")}
                                </Button>
                                <Button
                                    variant={"outlined"}
                                    color={"warning"}
                                    hidden={hideAdvanced}
                                    onClick={toggleAdvanced}
                                >
                                    {translate("Show Advanced")}
                                </Button>
                                <Paper variant={"outlined"} hidden={hideAdvanced}>
                                    <FormLabel id={"lbl-adv-algorithms"} hidden={hideAlgorithms}>
                                        {translate("Algorithm")}
                                    </FormLabel>
                                    <RadioGroup
                                        row
                                        aria-labelledby={"lbl-adv-algorithms"}
                                        value={optionAlgorithm}
                                        hidden={hideAlgorithms}
                                        onChange={(e, value) => {
                                            setOptionAlgorithm(value);
                                            e.preventDefault();
                                        }}
                                    >
                                        {optionAlgorithms.map((algorithm) => (
                                            <FormControlLabel value={algorithm} control={<Radio />} label={algorithm} />
                                        ))}
                                    </RadioGroup>
                                    <FormLabel id={"lbl-adv-lengths"} hidden={hideLengths}>
                                        {translate("Length")}
                                    </FormLabel>
                                    <RadioGroup
                                        row
                                        aria-labelledby={"lbl-adv-lengths"}
                                        value={optionLength}
                                        hidden={hideLengths}
                                        onChange={(e, value) => {
                                            setOptionLength(value);
                                            e.preventDefault();
                                        }}
                                    >
                                        {optionLengths.map((length) => (
                                            <FormControlLabel value={length} control={<Radio />} label={length} />
                                        ))}
                                    </RadioGroup>
                                    <FormLabel id={"lbl-adv-periods"} hidden={hidePeriods}>
                                        {translate("Seconds")}
                                    </FormLabel>
                                    <RadioGroup
                                        row
                                        aria-labelledby={"lbl-adv-periods"}
                                        value={optionPeriod}
                                        hidden={hidePeriods}
                                        onChange={(e, value) => {
                                            setOptionPeriod(value);
                                            e.preventDefault();
                                        }}
                                    >
                                        {optionPeriods.map((period) => (
                                            <FormControlLabel value={period} control={<Radio />} label={period} />
                                        ))}
                                    </RadioGroup>
                                </Paper>
                            </FormControl>
                        )}
                    </Fragment>
                );
            case 1:
                return (
                    <Box>
                        <Box className={styles.googleAuthenticator}>
                            <Typography className={styles.googleAuthenticatorText}>
                                {translate("Need Google Authenticator?")}
                            </Typography>
                            <AppStoreBadges
                                iconSize={128}
                                targetBlank
                                className={styles.googleAuthenticatorBadges}
                                googlePlayLink={GoogleAuthenticator.googlePlay}
                                appleStoreLink={GoogleAuthenticator.appleStore}
                            />
                        </Box>
                        <Box className={classnames(qrcodeFuzzyStyle, styles.qrcodeContainer)}>
                            <Link href={totpSecretURL} underline="hover">
                                <QRCodeSVG value={totpSecretURL} className={styles.qrcode} size={256} />
                                {!hasErrored && totpIsLoading ? (
                                    <CircularProgress className={styles.loader} size={128} />
                                ) : null}
                                {hasErrored ? (
                                    <FontAwesomeIcon className={styles.failureIcon} icon={faTimesCircle} />
                                ) : null}
                            </Link>
                        </Box>
                        <Box>
                            {secretURL !== "empty" ? (
                                <TextField
                                    id="secret-url"
                                    label={translate("Secret")}
                                    className={styles.secret}
                                    value={secretURL}
                                    InputProps={{
                                        readOnly: true,
                                    }}
                                />
                            ) : null}
                            {totpSecretBase32
                                ? SecretButton(totpSecretBase32, translate("OTP Secret copied to clipboard"), faKey)
                                : null}
                            {secretURL !== "empty"
                                ? SecretButton(secretURL, translate("OTP URL copied to clipboard"), faCopy)
                                : null}
                        </Box>
                    </Box>
                );
        }
    }

    const handleOnClose = () => {
        if (activeStep === 0 || !props.open) {
            return;
        }

        handleClose();
    };

    return (
        <Dialog open={props.open} onClose={handleOnClose} maxWidth={"xs"} fullWidth={true}>
            <DialogTitle>{translate("Register Webauthn Credential (Security Key)")}</DialogTitle>
            <DialogContent>
                <Grid container spacing={0} alignItems={"center"} justifyContent={"center"} textAlign={"center"}>
                    <Grid item xs={12}>
                        <Stepper activeStep={activeStep}>
                            {steps.map((label, index) => {
                                const stepProps: { completed?: boolean } = {};
                                const labelProps: {
                                    optional?: React.ReactNode;
                                } = {};
                                return (
                                    <Step key={label} {...stepProps}>
                                        <StepLabel {...labelProps}>{translate(label)}</StepLabel>
                                    </Step>
                                );
                            })}
                        </Stepper>
                    </Grid>
                    <Grid item xs={12}>
                        {renderStep(activeStep)}
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={activeStep === 0 && state !== WebauthnTouchState.Failure}>
                    {translate("Cancel")}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

const useStyles = makeStyles((theme: Theme) => ({
    icon: {
        paddingTop: theme.spacing(4),
        paddingBottom: theme.spacing(4),
    },
    instruction: {
        paddingBottom: theme.spacing(4),
    },
}));
