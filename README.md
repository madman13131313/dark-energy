# Dark Energy / 黑色能量

用摄像头里的手，推动一团漂浮的黑色物质。第一版先探索它的流动感、重量和接触反馈。

## 在电脑上运行

准备 Chrome、Git 和 **Node.js 22.12 或更新的 LTS 版本**。打开终端：

```sh
git clone https://github.com/madman13131313/dark-energy.git
cd dark-energy
npm install
npm run dev
```

这是私有仓库，克隆时需要使用有权限的 GitHub 账号。也可以从 GitHub 的 **Code → Download ZIP** 下载，解压后在项目目录执行后面两条 npm 命令。

Chrome 打开终端显示的地址，默认是 **http://localhost:5173**。如果端口已被占用，以终端实际显示的地址为准。

1. 先移动鼠标推动黑色能量，不需要点击或开启摄像头。
2. 点击「开启摄像头」，允许摄像头权限。
3. 让整只手进入画面，用指尖或手掌接触能量；支持两只手。
4. 慢慢推会产生局部变形，快速挥动会把它推走。停下来后能量会聚拢并缓慢漂浮。
5. 可以调节流动程度和推动力度、暂停、重置、隐藏手部轨迹或全屏。
6. 「关闭摄像头」会停止摄像头并释放识别线程，仍可用鼠标试玩。

首次 `npm install` 会复制固定版本的 MediaPipe SDK / WASM，并从 Google 官方地址下载约 7.5 MB 的手部模型。安装需要网络；之后识别在本地进行，不需要远程推理服务。

如果下载模型失败，鼠标模式仍能运行。恢复网络后执行：

```sh
npm run setup
```

## 当前功能与边界

- 摄像头镜像预览；保留完整画幅，手部坐标同步映射到实际视频区域。
- MediaPipe 双手追踪；指尖、手指关节和手掌共同形成接触区域。
- 弹性粒子团 + WebGL metaball 表面，深黑中心、薄油膜边缘、持续轮廓起伏。
- 接触排斥、挥动动量、屏幕边缘反弹、变形后的聚拢。
- 鼠标 / 触屏试玩；摄像头权限或模型失败时给出恢复提示。
- 响指生成、多团融合、切割、抓取、拉伸暂未实现。

这一版是 **二维摄像头叠加实验**，没有真实空间深度和手部遮挡：在画面中的位置相遇就会产生接触。真实摄像头下的识别稳定性和推动感觉还需要试玩调节。优先测试桌面 Chrome；未验证真实 iPhone / iPad 摄像头兼容性。

## 隐私

仅在点击按钮后请求摄像头。不请求麦克风，不录制、不保存、不上传摄像头画面，没有分析统计或后台服务。SDK、WASM 和模型在安装时下载，运行时由本地开发服务提供。

## 开发

采用 Vite + TypeScript + MediaPipe + 原生 WebGL。单页原型不需要 React / Next.js 或 Three.js；保留独立的物理和渲染模块，便于继续扩展。

```sh
npm test       # 坐标映射、快速扫过接触、长期模拟与聚拢
npm run build # TypeScript 检查和生产构建
npm run preview
```

手部推理放在 classic Web Worker 中，每秒最多发送 20 帧、每次只有一帧在处理。渲染独立运行，过期手部位置会清除；动画切回前台时不会追赶后台累积的时间。

```text
src/main.ts                摄像头、交互、界面与生命周期
src/physics.ts             弹性粒子团、接触力和镜像坐标
src/renderer.ts            WebGL 连续表面
public/tracking.worker.js  MediaPipe 后台识别
scripts/setup-assets.mjs   下载并准备本地模型与 SDK
```

## 常见问题

- **相机无法打开：** 使用 localhost 或 HTTPS，在 Chrome 地址栏允许摄像头权限。普通局域网 HTTP 地址通常不能调用摄像头。
- **相机被占用：** 关闭视频会议软件或其他使用摄像头的标签页。
- **模型加载失败：** 执行 `npm run setup`，然后重新运行。不要直接双击 `index.html`。
- **识别不稳定：** 保持光线充足，让手和背景有区别，手不要贴得过近，先用较慢的动作。
- **能量看不见 / WebGL 不可用：** 检查 Chrome 的硬件加速设置；本原型需要 WebGL。
- **推得太猛或太弱：** 调整「推动力度」。当前没有统一校准，不同镜头距离会影响手掌接触面积。

参考：[Google MediaPipe Hand Landmarker 官方指南](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)。依赖及模型保留其各自许可，本项目暂未授予额外的开源许可。
