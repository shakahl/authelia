import React from "react";

import { Grid } from "@mui/material";

import { UserInfo } from "@models/UserInfo";
import { AutheliaState } from "@services/State";
import TOTPPanel from "@views/Settings/TwoFactorAuthentication/TOTPPanel";
import WebauthnDevicesPanel from "@views/Settings/TwoFactorAuthentication/WebauthnDevicesPanel";

interface Props {
    state: AutheliaState;
    info: UserInfo;
}

export default function TwoFactorAuthSettings(props: Props) {
    return (
        <Grid container spacing={2}>
            <Grid item xs={12}>
                <TOTPPanel state={props.state} info={props.info} />
                <WebauthnDevicesPanel state={props.state} />
            </Grid>
        </Grid>
    );
}
