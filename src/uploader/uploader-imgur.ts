import { request, RequestUrlParam } from 'obsidian'
import { ImgurParms } from '../parms/parms-imgur'
import { EmoFormData } from '../utils/emo-formdata'
import { EmoUploader } from '../base/emo-uploader'
import { CONTENT_TYPE_FORMDATA, IMGUR_ACCESS_TOKEN_LOCALSTORAGE_KEY, IMGUR_DEFAULT_ID } from '../base/constants'
import { t } from '../lang/helpers'

export class ImgurUploader extends EmoUploader {
  parms!: ImgurParms
  constructor (imgurlParms: ImgurParms) {
    super()
    this.parms = imgurlParms
  }

  async upload (file: File): Promise<string> {
    const formData = new EmoFormData()
    await formData.add('image', file)
    let req: RequestUrlParam
    if (this.parms.anonymous) { // anonymous upload
      let auth = 'Client-ID '
      if (this.parms.clientid !== '') { auth += this.parms.clientid } else auth += IMGUR_DEFAULT_ID
      req = {
        url: 'https://api.imgur.com/3/upload',
        method: 'POST',
        headers: {
          'Content-Type': CONTENT_TYPE_FORMDATA,
          Authorization: auth
        },
        body: formData.getBody()
      }
    } else { // auth upload
      const accessToken = localStorage.getItem(IMGUR_ACCESS_TOKEN_LOCALSTORAGE_KEY)
      if (accessToken !== null) {
        req = {
          url: 'https://api.imgur.com/3/image',
          method: 'POST',
          headers: {
            'Content-Type': CONTENT_TYPE_FORMDATA,
            Authorization: `Bearer ${accessToken}`
          },
          body: formData.getBody()
        }
      } else {
        return t('no sign in')
      }
    }
    return await new Promise((resolve, reject) => {
      request(req).then((res) => {
        const json = JSON.parse(res)
        const hash = json.data.deletehash
        const url = json.data.link
        let markdownText: string
        if (this.parms.anonymous) { markdownText = `![${hash as string}](${url as string})` } else markdownText = `![Imgur](${url as string})`
        resolve(markdownText)
      }).catch(err => {
        reject(err)
      })
    })
  }
}
