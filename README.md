# 🏊‍♂️ Triathlon Training Assistant

A real-time web application that helps triathlon athletes improve their training experience through live communication, interactive interfaces and real-time feedback.

This project was developed as part of a university team project at Universidad Carlos III de Madrid.

---

## 📖 Overview

Triathlon Training Assistant is a real-time web application developed as a university project to improve the training experience of triathlon athletes.

The system connects a smartphone and a computer through Socket.IO. The smartphone captures the athlete using its camera while the desktop application performs posture analysis in real time using MediaPipe Pose.

During training, users receive voice feedback, can control the application using speech recognition, monitor live statistics and access complementary tools designed for indoor triathlon sessions.

---

## 🚀 Features

- Real-time posture analysis using MediaPipe Pose
- Live communication between mobile and desktop using Socket.IO
- Voice commands with Speech Recognition
- Voice feedback using Speech Synthesis
- Interactive training dashboard
- Automatic workout calibration
- Multiple training modes (Running, Swimming and Cycling)
- Automatic pause when no athlete is detected
- Nearby gym finder using Leaflet and OpenStreetMap
- Session statistics and performance summary

---

## 🏗️ Architecture

The application follows a distributed client-server architecture.

Mobile device

↓

Captures the athlete

↓

Node.js Server

↓

Desktop application

↓

MediaPipe Pose Analysis

↓

Voice feedback

## 💻 Technologies

- JavaScript
- HTML5
- CSS3
- Node.js
- Express
- Socket.IO
- MediaPipe Pose
- Web Speech API
- Leaflet
- OpenStreetMap API

---

## ⚙️ Installation

Clone the repository:

```bash
git clone https://github.com/sergio-villafuertes/triathlon-training-assistant.git
```

Install the dependencies:

```bash
npm install
```

Start the application:

```bash
npm run tunnel
```

Once the server is running, open your browser and access the application through the generated local address.

---

## 👨‍💻 My Contributions

My main contributions included:

- Development of several client-side features in app.js.
- Implementation of user interface components using HTML and CSS.
- Front-end integration and usability improvements.
- Testing and debugging during application development.

---

## 📁 Project Structure

```
triathlon-training-assistant
│
├── public/
│   ├── app.js
│   ├── index.html
│   ├── pinganillo.html
│   ├── pinganillo.css
│   └── style.css
│
├── server.js
├── runner.js
├── package.json
├── README.md
└── .gitignore
```

---

## 🔮 Future Improvements

- Adaptive posture profiles.
- Session history.
- User authentication.
- Performance analytics.
- Improved posture detection.

---

## 📄 License

This project is distributed under the MIT License.