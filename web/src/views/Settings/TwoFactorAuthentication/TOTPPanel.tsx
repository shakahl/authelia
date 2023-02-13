import React, { Fragment, Suspense, useEffect } from "react";

import { Box, Button, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { useNotifications } from "@hooks/NotificationsContext";
import { useUserInfoTOTPConfiguration } from "@hooks/UserInfoTOTPConfiguration";
import { UserInfo } from "@models/UserInfo";
import { AutheliaState } from "@services/State";
import LoadingPage from "@views/LoadingPage/LoadingPage";

interface Props {
    state: AutheliaState;
    info: UserInfo;
}

export default function TOTPPanel(props: Props) {
    const { t: translate } = useTranslation("settings");

    const { createErrorNotification } = useNotifications();

    const [config, fetchConfig, , fetchConfigError] = useUserInfoTOTPConfiguration();

    useEffect(() => {
        if (!props.info.has_totp) {
            return;
        }

        fetchConfig();
    }, [props.info.has_totp, fetchConfig]);

    useEffect(() => {
        if (!fetchConfigError) {
            return;
        }

        createErrorNotification("There was an issue retrieving One Time Password Configuration");
    }, [fetchConfigError, createErrorNotification]);

    return (
        <Fragment>
            <Paper variant="outlined">
                <Box sx={{ p: 3 }}>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="h5">{translate("Webauthn Credentials")}</Typography>
                        </Box>
                        <Box>
                            <Tooltip title={translate("Click to add a Time-based One Time Password to your account")}>
                                <Button variant="outlined" color="primary" onClick={} disabled={}>
                                    {translate("Add One Time Password")}
                                </Button>
                            </Tooltip>
                        </Box>
                        <Suspense fallback={<LoadingPage />}></Suspense>
                    </Stack>
                </Box>
            </Paper>
        </Fragment>
    );
}
