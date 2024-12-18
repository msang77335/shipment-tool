import { HashicorpVaultHelper } from "neopay-lib/helpers";
import { REQUIRED_KEY, SVC_ENV } from "../svc-env";

export class VaultSecurity {
	public static async overWriteVaultEnv(): Promise<void> {
		const vaultResponse = await this.getVaultEnvs();
		const vaultData = vaultResponse?.data || null;
		if (!vaultData) {
			console.log(SVC_ENV.get().SERVICE_NAME + ".HAVE_NOT_VAULT_ENV" + (vaultResponse?.error && ` with error: ${JSON.stringify(vaultResponse.error)}`));
			return;
		}
		console.log(SVC_ENV.get().SERVICE_NAME + "-overWriteVaultEnv");
		Object.keys(vaultData).forEach(keyVault => {
			SVC_ENV.set(keyVault, vaultData[keyVault]);
		});
	}

	public static checkMissingEnvVariable(): boolean {
		const envVariable = SVC_ENV.get();
		let isMissingEnvVariable = false;
		REQUIRED_KEY.forEach(keyMustHave => {
			if (!envVariable[keyMustHave]) {
				console.log("MIS_ENV_KEY: " + keyMustHave);
				isMissingEnvVariable = true;
			}
		});
		return isMissingEnvVariable;
	}

	private static async getVaultEnvs(): Promise<any> {
		const apiVersion = SVC_ENV.get().VAULT_VERSION;
		const endpoint = SVC_ENV.get().VAULT_ENDPOINT;
		const roleId = SVC_ENV.get().VAULT_ROLE_ID;
		const secretId = SVC_ENV.get().VAULT_SECRET_ID;
		const secretPath = SVC_ENV.get().VAULT_KV_PATH;
		return await HashicorpVaultHelper.getSecretData(endpoint, apiVersion, roleId, secretId, secretPath);
	}
}
