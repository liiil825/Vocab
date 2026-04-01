# TODO

## 已完成

- [x] 自定义 Modal 弹窗替换浏览器 confirm()
- [x] 复习完成页显示失败/模糊单词列表
- [x] Next Review Countdown - 显示距下一个单词复习的倒计时
- [x] 播放发音功能 (Web Speech API + Google Translate TTS)

## 待解决

### 播放发音功能
**问题**: Chrome 浏览器语音合成不可用
- Arch Linux 环境下 Chrome 没有内置英文语音包
- Web Speech API 的 voices 列表为空
- Google Translate TTS CORS 被阻止

**尝试过的方案**:
1. Web Speech API (speechSynthesis) - voices 列表为空
2. Google Translate TTS API - CORS 阻止
3. 系统 TTS 引擎 (espeak, flite) - 未安装

**可选方案**:
1. 使用有 CORS 支持的第三方 TTS API (如 Forvo, MDN TTS)
2. 使用 Web Audio API 合成简单音频
3. 让用户自己安装 Chrome 英文语音包
4. 后端实现 TTS API (调用外部服务如 Google Cloud TTS)
