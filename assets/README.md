# 素材说明

生成好的原图已经处理并接入 App，**不需要再手动放文件**。

当前 `app/assets/` 里的文件（已压缩，适合手机加载）：

| 文件名 | 用途 | 来源 |
| --- | --- | --- |
| `app-icon.png` | 主屏幕图标（源图 1024） | 打开的书 |
| `avatar-boy.webp` | 男孩头像（320） | 2_男孩 |
| `avatar-girl.webp` | 女孩头像（320） | 3_女孩 |
| `illust-empty.webp` | 记录库空状态 | D1 看蚂蚁 |
| `illust-no-object.webp` | 首页无对象空状态 | D2 举相机 |
| `illust-about.webp` | 关于页（预留） | D3 老师和孩子 |
| `illust-export.webp` | 导出完成（预留） | D4 举画纸 |
| `bg.jpg` | 首页背景（1080×1920） | 4_页面背景 |

- 原始大图保存在 `素材/原图/`，需要重新压缩时运行 `python tools/prepare_assets.py` + `python tools/optimize_assets.py`。
- 图标由 `python tools/make_icons.py` 从 `app-icon.png` 生成到 `app/icons/`。
- 如果以后想换某张图：把新图放到 `素材/原图/`，按上表改名后重新运行脚本，或直接告诉我。

> 这个文件夹会随程序发布到网上，不要放孩子的真实照片。记录里的照片由 App 在手机上拍摄，只存在本机。
