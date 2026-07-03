# M4 Competition — The Pursuit of Velocity

An immersive, cinematic 3D product showcase for the **BMW M4 Competition**, built around a real, interactive GLB model, scroll-driven camera choreography, and a full performance/design storytelling experience — from the S58 twin-turbo engine to the cockpit, brakes, and a multi-angle "walk around it" viewer.

🔗 **Live Demo:** [bmw-m4-eta.vercel.app](https://bmw-m4-eta.vercel.app/)

---

## 📌 Overview

This project is a single-page, scrollytelling-style showcase site for the BMW M4 Competition ("Generation VI"). It renders an actual 3D GLB model of the car directly in the browser using Three.js, orbiting and reframing as the user scrolls through numbered sections — from design philosophy, to powertrain, to interior, to a full spec sheet and multi-angle viewer.

> *Concept showcase — "Not an official BMW property," created for design & development portfolio purposes.*

---

## ✨ Features

### 🎥 3D Model & Camera System
- **Real GLB Model Integration** – A fully rigged BMW M4 GLB model rendered live in-browser via **Three.js**, with the model optimized through **geometry quantization** and **WebP texture compression** for fast load times
- **Auto-Orbit Hero Camera** – "CAM ORBIT.AUTO" hero state with a percentage-based load indicator (`0%` → 100%) before reveal
- **Scroll-Driven Camera Choreography** – Camera position/target reframes as the user scrolls between numbered sections (00 → 09), tied to scene milestones (exterior, interior, engine, brakes)
- **"Walk Around It" Multi-Angle Viewer** – Selectable camera presets: Front Quarter, Side Profile, Rear Stance, Top Down, Cockpit

### 🧭 Structured Scroll Sections
| # | Section | Focus |
|---|---|---|
| 00 | Hero | "THE M4 COMPETITION" intro, auto-orbiting camera, scroll cue |
| 01 | An Obsession, Given Form | Design philosophy — aero-driven bodywork, 3.0L Twin-Turbo I6, M xDrive AWD, Carbon Roof & Aero Pack |
| 02 | Numbers That Argue Back | Animated stat counters — Power, Torque, 0–100 km/h, Top Speed, Transmission, Weight Distribution |
| 03 | Surface as Strategy | Exterior detailing — laser headlights, carbon-fibre roof, M Compound forged wheels |
| 04 | Cockpit, Not Cabin | Interior — M Carbon bucket seats, 12.3" curved digital display, Alcantara headliner/wheel |
| 05 | S58. The Heart of the Matter | Engine deep-dive — closed-deck block, twin mono-scroll turbos, GT3-derived cooling, Active M Differential, 4 Drive Modes |
| 06 | Where Power Meets Road | M Compound brakes with blue calipers |
| 07 | Specification Sheet | Full spec table (see below) |
| 08 | Walk Around It | Interactive multi-angle camera viewer |
| 09 | Configure Yours | Configurator CTA + "Request a callback" contact form |

### 🔢 Animated Stat Counters
Numbers count up on scroll-into-view for:
- Power Output
- Peak Torque
- 0–100 km/h
- Top Speed (M Driver's Package)
- M Steptronic Transmission
- Weight Distribution

### 📋 Full Specification Sheet
| Spec | Value |
|---|---|
| Engine | 3.0L M TwinPower Turbo Inline-6 |
| Power | 503 hp @ 6,250 rpm |
| Torque | 650 Nm @ 2,750–5,950 rpm |
| 0–100 km/h | 3.5 seconds |
| Top Speed | 290 km/h (M Driver's Package) |
| Transmission | 8-Speed M Steptronic |
| Drivetrain | M xDrive, AWD |
| Weight Distribution | 50:50 front/rear |
| Curb Weight | 1,725 kg |
| Brakes | M Compound, blue calipers |

### 🧭 Sticky / Dual Navigation
- Compact top nav: Overview · Performance · Exterior · Interior · Specs · Contact
- Expanded nav (on scroll or menu open): adds Technology and Gallery
- Sticky "Configure" CTA button

### 📞 Contact / Configure Section
- "Request a callback" form for product-specialist follow-up
- Footer with Model / Explore / Connect link groups and social placeholders (Instagram, YouTube, Press Kit)

---

## 🛠️ Tech Stack

- **3D Rendering:** [Three.js](https://threejs.org/) — real GLB model loading, custom scene/camera rig
- **Model Optimization:** Geometry quantization + WebP texture compression for faster load and smaller payload
- **Scroll Animation:** GSAP + ScrollTrigger — drives camera movement, section reveals, and animated stat counters in sync with scroll position
- **Frontend:** HTML5, CSS3, JavaScript
- **Deployment:** [Vercel](https://vercel.com/)
- **Version Control:** Git & GitHub

---

## 📂 Project Structure

```
BMW-M4/
├── public/
│   ├── models/                # M4 GLB model (quantized geometry, compressed textures)
│   └── images/                 # UI icons, fallback imagery
├── src/
│   ├── three/                  # Scene setup, camera rig, GLB loader, orbit/scroll logic
│   ├── components/              # Nav, Hero, Stat Counters, Spec Table, Contact Form
│   ├── styles/                   # CSS (section layout, nav, counters)
│   └── scripts/                   # GSAP ScrollTrigger timelines
├── README.md
└── package.json
```

*(Adjust structure above to match your actual repository layout.)*

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Parthsharma321/BMW-M4.git

# Navigate into the project directory
cd BMW-M4

# Install dependencies
npm install

# Run the development server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) (or the appropriate port) in your browser.

### Build for Production

```bash
npm run build
```

> ⚠️ **Performance note:** The 3D GLB model should stay geometry-quantized and texture-compressed (WebP) to keep initial load fast, especially on mobile. If you swap in a new model, re-run it through a compression/quantization pipeline (e.g. `gltf-transform`) before deploying.

---

## 🌐 Deployment

This project is deployed on **Vercel**. Any push to the main branch automatically triggers a new deployment.

Live URL: [https://bmw-m4-eta.vercel.app/](https://bmw-m4-eta.vercel.app/)

To deploy your own version:

1. Fork/clone this repository
2. Import the project into [Vercel](https://vercel.com/new)
3. Connect your GitHub repository
4. Deploy 🎉

---

## 📸 Preview

Add screenshots or a short capture of the 3D scroll experience here:

```markdown
![Hero — Auto Orbit](./public/images/preview-hero.png)
![Numbers That Argue Back](./public/images/preview-stats.png)
![Cockpit Interior](./public/images/preview-interior.png)
![S58 Engine Section](./public/images/preview-engine.png)
![Walk Around It — Multi-Angle Viewer](./public/images/preview-walkaround.png)
```

---

## 🗺️ Roadmap / Future Improvements

- [ ] Add real-time paint color / wheel configurator tied to the 3D model
- [ ] Add exterior/interior lighting presets (day/night HDRI environments)
- [ ] Hook up the "Request a callback" form to a real backend/email service
- [ ] Add loading progress bar tied to actual GLB/texture byte size, not just estimated %
- [ ] Improve accessibility (keyboard-navigable camera presets, ARIA labels on stat counters)
- [ ] Add mobile-optimized lower-poly model variant for low-end devices

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is a demo/concept build for portfolio purposes. Add your preferred license (e.g., MIT) here if you intend to open-source it.

```
MIT License © 2026 Parth Sharma
```

---

## 👤 Author

**Parth Sharma**

- GitHub: [@Parthsharma321](https://github.com/Parthsharma321)
- Repository: [BMW-M4](https://github.com/Parthsharma321/BMW-M4)

---

## ⚠️ Disclaimer

This is an unofficial, fan-made/portfolio demo website created for design and development practice. As stated on the live site itself, it is **"Not an official BMW property."** All product names, model names, logos, and brands are property of their respective owners (BMW M GmbH).
