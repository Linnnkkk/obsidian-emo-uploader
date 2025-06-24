import type { RequestUrlParam } from "obsidian";
import { request } from "obsidian";
import { EmoFormData } from "../utils/emo-formdata";
import { EmoUploader } from "../base/emo-uploader";
import { CONTENT_TYPE_FORMDATA } from "../base/constants";
import type { AlistParms } from "../parms/parms-alist";
import { sha256 } from "js-sha256";

export class AlistUploader extends EmoUploader {
  parms!: AlistParms;
  constructor(alistParms: AlistParms) {
    super();
    this.parms = alistParms;
  }

  async upload(file: File): Promise<string> {
    // 为所有文件添加毫秒级时间戳
    const timestampedName = this.addTimestampToFilename(file.name);

    // 获取token
    const token = await this.getToken();
    // 确保上传目录存在
    const determine = await this.determine();
    if (determine !== "success") {
      await this.mkdirDir();
    }
    // 上传文件（使用带时间戳的文件名）
    await this.putFile(file, timestampedName);

    // 刷新目录前等待1秒
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 尝试获取文件链接（最多5次）
    let markdownText = "";
    for (let attempt = 1; attempt <= 5; attempt++) {
      // 每次尝试前刷新目录
      await this.refreshDir();

      // 获取文件链接
      try {
        markdownText = await this.getFileLink(timestampedName, token);
        if (markdownText) break; // 成功获取链接则退出循环
      } catch (error) {
        console.error(`获取文件链接失败 (尝试 ${attempt}/5):`, error);
      }

      // 如果不是最后一次尝试，则等待1秒
      if (attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!markdownText) {
      throw new Error("无法获取文件链接，请检查文件是否上传成功");
    }

    return markdownText;
  }

  // 为文件名添加毫秒级时间戳
  private addTimestampToFilename(originalName: string): string {
    // 提取文件名和扩展名
    const dotIndex = originalName.lastIndexOf(".");
    let nameWithoutExt = originalName;
    let extension = "";

    if (dotIndex !== -1) {
      nameWithoutExt = originalName.substring(0, dotIndex);
      extension = originalName.substring(dotIndex);
    }

    // 生成毫秒级时间戳（纯数字）
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      (now.getMonth() + 1).toString().padStart(2, "0"),
      now.getDate().toString().padStart(2, "0"),
      now.getHours().toString().padStart(2, "0"),
      now.getMinutes().toString().padStart(2, "0"),
      now.getSeconds().toString().padStart(2, "0"),
      now.getMilliseconds().toString().padStart(3, "0"),
    ].join(""); // 格式: YYYYMMDDHHmmssSSS

    // 返回带时间戳的新文件名
    return `${nameWithoutExt}_${timestamp}${extension}`;
  }

  // 获取文件链接
  async getFileLink(fileName: string, token: string): Promise<string> {
    const req: RequestUrlParam = {
      url: `${this.parms.required.domain}/api/fs/get`,
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: `/${this.parms.required.getfilePath}/${fileName}`,
      }),
    };

    const res = await request(req);
    const json = JSON.parse(res);

    // 检查是否成功获取到链接
    if (!json.data || !json.data.raw_url) {
      throw new Error("文件链接未返回");
    }

    return `![${fileName}](${json.data.raw_url as string})`;
  }

  // 获取token
  async getToken(): Promise<string> {
    const req: RequestUrlParam = {
      url: `${this.parms.required.domain}/api/auth/login/hash`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: this.parms.required.username,
        password: sha256(this.parms.required.password + "-qweqweqweqweqweqwe"),
      }),
    };

    const res = await request(req);
    const json = JSON.parse(res);
    return json.data.token as string;
  }

  // 判断上传目录是否存在
  async determine(): Promise<string> {
    const req: RequestUrlParam = {
      url: `${this.parms.required.domain}/api/fs/get`,
      method: "POST",
      headers: {
        Authorization: await this.getToken(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: `/${this.parms.required.getfilePath}`,
      }),
    };

    const res = await request(req);
    const json = JSON.parse(res);
    return json.message as string;
  }

  // 创建上传目录
  async mkdirDir(): Promise<void> {
    const req: RequestUrlParam = {
      url: `${this.parms.required.domain}/api/fs/mkdir`,
      method: "POST",
      headers: {
        Authorization: await this.getToken(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: `/${this.parms.required.uploadPath}`,
      }),
    };
    await request(req);
  }

  // 上传文件（接受新文件名）
  async putFile(file: File, newFileName: string): Promise<void> {
    const formData = new EmoFormData();
    await formData.add("file", file);
    const req: RequestUrlParam = {
      url: `${this.parms.required.domain}/api/fs/form`,
      method: "PUT",
      headers: {
        Authorization: await this.getToken(),
        "Content-Type": CONTENT_TYPE_FORMDATA,
        "File-Path": encodeURIComponent(
          `/${this.parms.required.uploadPath}/${newFileName}`,
        ),
        "As-Task": "true",
      },
      body: formData.getBody(),
    };
    await request(req);
  }

  // 刷新目录
  async refreshDir(): Promise<void> {
    const req: RequestUrlParam = {
      url: `${this.parms.required.domain}/api/fs/list`,
      method: "POST",
      headers: {
        Authorization: await this.getToken(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: `/${this.parms.required.getfilePath}`,
        page: 1,
        password: "",
        per_page: 0,
        refresh: true,
      }),
    };
    await request(req);
  }
}
