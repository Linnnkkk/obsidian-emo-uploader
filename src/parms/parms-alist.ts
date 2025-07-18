import type { EmoParms } from "../base/emo-parms";

export interface AlistParms extends EmoParms {
  required: Required;
}

interface Required {
  domain: string;
  username: string;
  password: string;
  uploadPath: string;
  getfilePath: string;
}

export const ALIST_DEFAULT_PARMS: AlistParms = {
  required: {
    domain: "",
    username: "",
    password: "",
    uploadPath: "",
    getfilePath: "",
  },
};
