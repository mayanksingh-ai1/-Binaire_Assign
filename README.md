# 🖼️ ImageForge - Image Processing Tool (Electron App)

## 🚀 Overview

ImageForge is a desktop-based image processing tool built using ElectronJS and ReactJS.
It allows users to import images, apply various editing operations, perform HDR merging using OpenCV.js, and export processed images in multiple formats.

This project was developed as part of a 1-week technical assessment focusing on UI design, performance optimization, and efficient image processing.

---

## 🎯 Features

### 📥 Image Import

* Supports JPEG, PNG, WebP formats
* Easy image loading with top toolbar controls

### 🎨 UI & Design

* Smooth transitions and animations
* Clean and responsive UI
* Right panel for tools, sliders, adjustments
* Top toolbar for import/export actions

### 🖼️ Canvas Operations

* Image rendering using HTML5 Canvas
* Zoom in / Zoom out functionality
* Image panning support

### 🧠 Editing History

* Tracks all editing operations
* Undo/Redo functionality

### 🌄 HDR Merge (OpenCV.js)

* Import multiple images
* Merge images into a single HDR output
* Uses OpenCV.js for advanced processing

### 📤 Export

* Export edited images in:

  * JPEG
  * PNG
* Save directly to device storage

### ⚡ Performance

* Tree-shaking implemented using Vite
* Optimized production build

---

## 🛠️ Tech Stack

* Electron.js
* React.js
* OpenCV.js
* Vite
* HTML5 Canvas

---

## 📁 Project Structure

```bash
imageforge/
├── electron/
│   ├── main.js
│   ├── preload.js
│   └── fuse.js
│
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   │
│   ├── components/
│   │   ├── TopToolbar.jsx
│   │   ├── ImageCanvas.jsx
│   │   ├── RightPanel.jsx
│   │   ├── HistoryPanel.jsx
│   │   └── HDRMergeModal.jsx
│   │
│   ├── hooks/
│   │   ├── useImageHistory.js
│   │   └── useOpenCV.js
│   │
│   └── utils/
│       ├── imageOps.js
│       └── opencvHDR.js
│
├── public/
│   └── opencv.js
│
├── assets/
│   └── icon.ico
│
├── index.html
├── vite.config.js
├── package.json
├── electron-builder.yml
└── obfuscate.js
```

---

## 📦 Getting Started (Clone & Run)

### 1️⃣ Clone Repository

```bash
git clone https://github.com/mayanksingh-ai1/-Binaire_Assign.git
cd imageforge
```

---

### 2️⃣ Install Dependencies

```bash
npm install
```

---

### 3️⃣ Run in Development Mode

```bash
npm run dev
```





