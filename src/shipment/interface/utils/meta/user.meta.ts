export interface UserMeta {
  _id: string;
  phone: string;
  merchantId: string;
  fullName: string;
  userId: string;
  userType: string;
  email: string;
  userName?: string;
  social: string;
  state: string;
  password: string;
  resetPasswordToken: unknown;
  resetPasswordTokenExpiredAt: string;
  isActive: boolean;
  isDelete: boolean;
  createdAt: string;
  createdBy: string;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
  orgs: any;
  searchInfo: any;
  app: {
    appId: string;
    appName: string;
    setting: {
      passwordPolicy: {
        tokenExpired: number;
        minLength: number;
        maxLength: number;
        number: boolean;
        specialChars: boolean;
        lowerCase: boolean;
        upperCase: boolean;
        blacklist: string;
        timeWarningChangePass: number;
        timeMustBeChangePass: number;
      };
      socketGateway: {
        url: string;
        path: string;
      };
    };
  };
  accountInfo: {
    _id: string;
    accountId: string;
    idRef: string;
    type: string;
    walletType: number;
    walletId: string;
    connectorInfo: {
      fmarketId: string;
    };
  };
  accountId: string;
  tokenId: string;
}
