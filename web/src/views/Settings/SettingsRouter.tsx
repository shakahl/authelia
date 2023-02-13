import React, { useEffect } from "react";

import { Route, Routes } from "react-router-dom";

import { IndexRoute, SettingsTwoFactorAuthenticationSubRoute } from "@constants/Routes";
import { useNotifications } from "@hooks/NotificationsContext";
import { useRouterNavigate } from "@hooks/RouterNavigate";
import { useAutheliaState } from "@hooks/State";
import { useUserInfoPOST } from "@hooks/UserInfo";
import SettingsLayout from "@layouts/SettingsLayout";
import { AuthenticationLevel } from "@services/State";
import SettingsView from "@views/Settings/SettingsView";
import TwoFactorAuthenticationView from "@views/Settings/TwoFactorAuthentication/TwoFactorAuthenticationView";

export interface Props {}

const SettingsRouter = function (props: Props) {
    const navigate = useRouterNavigate();
    const { createErrorNotification } = useNotifications();

    const [state, fetchState, , fetchStateError] = useAutheliaState();
    const [info, fetchInfo, , fetchInfoError] = useUserInfoPOST();

    useEffect(() => {
        fetchState();
    }, [fetchState]);

    useEffect(() => {
        if (fetchStateError || (state && state.authentication_level < AuthenticationLevel.OneFactor)) {
            navigate(IndexRoute);

            return;
        }

        fetchInfo();
    }, [state, fetchStateError, navigate, fetchInfo]);

    useEffect(() => {
        if (fetchInfoError) {
            createErrorNotification("There was an issue retrieving user preferences");
        }
    }, [fetchInfoError, createErrorNotification]);

    const ready = state && info;

    return (
        <SettingsLayout>
            <Routes>
                <Route path={IndexRoute} element={<SettingsView />} />
                <Route
                    path={SettingsTwoFactorAuthenticationSubRoute}
                    element={ready ? <TwoFactorAuthenticationView state={state} info={info} /> : null}
                />
            </Routes>
        </SettingsLayout>
    );
};

export default SettingsRouter;
