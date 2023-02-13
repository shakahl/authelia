import {
    TOTPAlgorithmPayload,
    TOTPDigits,
    TOTPOptions,
    UserInfoTOTPConfiguration,
    toEnum,
} from "@models/TOTPConfiguration";
import { TOTPRegistrationOptionsPath, UserInfoTOTPConfigurationPath } from "@services/Api";
import { Get } from "@services/Client";

export interface UserInfoTOTPConfigurationPayload {
    created_at: string;
    last_used_at?: string;
    issuer: string;
    algorithm: TOTPAlgorithmPayload;
    digits: TOTPDigits;
    period: number;
}

export async function getUserInfoTOTPConfiguration(): Promise<UserInfoTOTPConfiguration> {
    const res = await Get<UserInfoTOTPConfigurationPayload>(UserInfoTOTPConfigurationPath);

    return {
        created_at: new Date(res.created_at),
        last_used_at: res.last_used_at ? new Date(res.last_used_at) : undefined,
        issuer: res.issuer,
        algorithm: toEnum(res.algorithm),
        digits: res.digits,
        period: res.period,
    };
}

export interface TOTPOptionsPayload {
    algorithm: TOTPAlgorithmPayload;
    algorithms: TOTPAlgorithmPayload[];
    length: TOTPDigits;
    lengths: TOTPDigits[];
    period: number;
    periods: number[];
}

export async function getTOTPOptions(): Promise<TOTPOptions> {
    const res = await Get<TOTPOptionsPayload>(TOTPRegistrationOptionsPath);

    return {
        algorithm: toEnum(res.algorithm),
        algorithms: res.algorithms.map((alg) => toEnum(alg)),
        length: res.length,
        lengths: res.lengths,
        period: res.period,
        periods: res.periods,
    };
}
