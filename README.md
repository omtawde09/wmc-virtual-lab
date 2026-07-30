# Wireless & Mobile Communication Virtual Lab

<p align="center">
  <h3 align="center">Interactive Virtual Laboratory for Wireless & Mobile Communication</h3>
  <p align="center">
    A browser-based virtual laboratory that enables students to perform Wireless & Mobile Communication experiments through real-time network measurements, signal analysis, Bluetooth communication, and wireless propagation simulations.
  </p>
</p>

---

# Overview

The **Wireless & Mobile Communication (WMC) Virtual Lab** is an interactive educational platform developed to digitize practical experiments for the Wireless & Mobile Communication laboratory.

Instead of relying entirely on physical laboratory equipment, the platform allows students to perform selected experiments directly from their computer using real hardware interfaces such as Wi-Fi adapters and Bluetooth devices, combined with software-based simulations and analytical tools.

The project consists of a modern React frontend and a FastAPI backend that communicate through REST APIs to perform real-time measurements, signal analysis, and visualization.

The application covers **Experiments 4 to 9** of the Wireless & Mobile Communication practical curriculum.

---

# Vision

Traditional networking laboratories often require specialized hardware, limited lab availability, and manual data collection.

The WMC Virtual Lab aims to:

- Improve accessibility to practical experiments
- Reduce dependence on expensive laboratory equipment
- Provide interactive learning experiences
- Enable real-time wireless network analysis
- Help students understand theoretical concepts through experimentation
- Support hybrid and remote laboratory environments

---

# Educational Objectives

The platform helps students understand practical aspects of wireless communication including:

- Wi-Fi Signal Propagation
- Bluetooth Communication
- Wireless Path Loss
- Throughput Measurement
- Latency Analysis
- Multipath Propagation
- Radio Frequency Interference
- Wireless Network Performance

Each experiment combines theoretical concepts with interactive practical implementation.

---

# Experiments Included

## Practical 4 — Wi-Fi Signal Strength Analysis

This experiment measures Wi-Fi signal strength (RSSI) at different distances from an access point.

Students can analyze:

- Signal Strength
- RSSI Values
- Distance vs Signal Loss
- Signal Stability
- Wireless Coverage

The experiment demonstrates how signal strength decreases with increasing distance.

---

## Practical 5 — Network Throughput & Latency

Measure network performance using real-time testing.

Students can evaluate:

- Download Speed
- Upload Speed
- Network Latency
- Ping Time
- Response Delay
- Overall Network Performance

This experiment introduces Quality of Service (QoS) concepts used in communication networks.

---

## Practical 6 — Bluetooth Communication

Explore Bluetooth networking through practical experimentation.

Features include:

- Nearby Device Discovery
- Bluetooth Scanning
- Device Information
- Connection Simulation
- Pairing Demonstration
- Signal Analysis

Students gain an understanding of Bluetooth communication protocols and short-range wireless networking.

---

## Practical 7 — Wireless Path Loss Analysis

Analyze how wireless signals are affected by environmental obstacles.

The experiment demonstrates the impact of:

- Distance
- Walls
- Glass
- Concrete Structures
- Metal Objects
- Environmental Obstructions

Students learn how propagation conditions influence wireless communication reliability.

---

## Practical 8 — Multipath Propagation

Demonstrates how reflected wireless signals create multiple propagation paths.

Students can observe:

- Direct Signal
- Reflected Signals
- Signal Delay
- Fading Effects
- Multipath Interference

This experiment explains one of the most important concepts in wireless communication systems.

---

## Practical 9 — Noise & Interference Analysis

Investigate wireless interference sources affecting network quality.

Students analyze:

- Signal-to-Noise Ratio
- Wireless Interference
- Environmental Noise
- Channel Congestion
- Network Quality

The experiment illustrates how interference reduces communication performance.

---

# Core Features

- Interactive Virtual Laboratory
- Real-Time Wi-Fi Scanning
- Bluetooth Device Discovery
- Network Speed Testing
- Wireless Path Loss Simulation
- Multipath Analysis
- Noise & Interference Visualization
- Educational Data Visualization
- REST API Architecture
- Responsive Web Interface

---

# Virtual Laboratory Workflow

```
Student Opens Virtual Lab
            │
            ▼
Select Practical
            │
            ▼
Run Experiment
            │
            ▼
Backend Measurement Engine
            │
            ▼
Signal Processing
            │
            ▼
Generate Results
            │
            ▼
Interactive Visualization
            │
            ▼
Observation & Analysis
```

---

# Application Architecture

```
              Wireless & Mobile Communication Lab

                   React Frontend (Vite)

                           │

                    REST API Requests

                           │

                     FastAPI Backend

        ┌──────────────┬──────────────┬──────────────┐
        ▼              ▼              ▼

   Wi-Fi Scanner   Network Tester   Bluetooth Engine

        ▼              ▼              ▼

 Path Loss Model  Multipath Engine  Interference Analysis

        ▼

      Results & Visualization
```

---

# Backend Modules

The backend follows a modular FastAPI architecture where each practical experiment is implemented as an independent service.

## Wi-Fi Scanner

Handles:

- RSSI Collection
- Access Point Detection
- Signal Measurement

---

## Network Tester

Responsible for:

- Throughput Analysis
- Download Speed
- Upload Speed
- Latency Measurement

---

## Bluetooth Scanner

Provides:

- Device Discovery
- Bluetooth Information
- Signal Detection

---

## Bluetooth Connection

Simulates Bluetooth pairing and connection workflows for educational purposes.

---

## Bluetooth Analyzer

Performs analysis of Bluetooth communication characteristics.

---

## Path Loss Analyzer

Evaluates wireless attenuation caused by distance and environmental obstacles.

---

## Multipath Analyzer

Models wireless signal reflection and fading due to multiple propagation paths.

---

## Interference Analyzer

Measures and visualizes wireless noise and interference affecting communication quality.

---

# Frontend Architecture

The frontend is built using a page-based React architecture.

```
src/

├── components/
│   └── Navbar
│
├── pages/
│   ├── Home
│   ├── Practical4
│   ├── Practical5
│   ├── Practical6
│   ├── Practical7
│   ├── Practical8
│   └── Practical9
│
├── assets/
│
└── App.jsx
```

Each experiment is implemented as an independent React page, making the application modular and easy to extend with future practicals.

---

# REST API Structure

The backend exposes dedicated API endpoints for each experiment.

| Practical | Endpoint |
|-----------|----------|
| Practical 4 | `/api/wifi` |
| Practical 5 | `/api/network` |
| Practical 6 | `/api/bluetooth` |
| Bluetooth Pairing | `/api/bluetooth/conn` |
| Bluetooth Analysis | `/api/bluetooth/analysis` |
| Practical 7 | `/api/pathloss` |
| Practical 8 | `/api/multipath` |
| Practical 9 | `/api/interference` |

The modular API structure enables each experiment to evolve independently.

---

# Technology Stack

## Frontend

- React
- Vite
- React Router
- JavaScript
- CSS3

---

## Backend

- FastAPI
- Python
- REST APIs

---

## Networking & Wireless

- Wi-Fi Interface Scanning
- Bluetooth Communication
- Network Performance Analysis

---

## Development

- Node.js
- npm
- Python Virtual Environment

---

# Engineering Highlights

The project follows modern software engineering practices.

Key architectural strengths include:

- Modular FastAPI services
- Independent experiment modules
- RESTful API architecture
- Component-based React frontend
- Separation of frontend and backend
- Experiment-specific routing
- Scalable laboratory design
- Local storage state reset for fresh experiments
- Cross-Origin Resource Sharing (CORS) support
- Clean educational workflow

---

# Educational Outcomes

Students gain practical exposure to:

- Wireless Communication Principles
- Wi-Fi Signal Analysis
- Bluetooth Networking
- Network Performance Evaluation
- Propagation Models
- Wireless Path Loss
- Multipath Propagation
- RF Interference
- Practical Networking Tools
- Data Interpretation

---

# Project Structure

```
wmc-virtual-lab/

├── backend/
│   ├── main.py
│   ├── wifi_scanner.py
│   ├── network_tester.py
│   ├── bluetooth_scanner.py
│   ├── bluetooth_connection.py
│   ├── bluetooth_analyzer.py
│   ├── bluetooth_pathloss.py
│   ├── multipath_analyzer.py
│   ├── interference_analyzer.py
│   └── requirements.txt
│
├── frontend/                # Vite + React web app (also bundled into the Android app)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── calc/            # JS ports of the Python analyzers (used on Android)
│   │   ├── docx/            # client-side experiment-document export
│   │   ├── hardware/        # platform abstraction (FastAPI vs native bridge)
│   │   └── App.jsx
│   │
│   ├── public/templates/   # syllabus .docx templates bundled with the build
│   ├── package.json
│   └── vite.config.js
│
├── android/                 # native Android WebView app + hardware bridge
├── docs/                    # setup and platform notes (see docs/ANDROID.md)
├── brand/                   # master logo artwork
└── scripts/                 # run-dev.bat, build-backend-exe.bat, sign-backend-exe.bat
```

---

# Design Philosophy

The project is built around four educational principles.

### Accessibility

Allow students to perform networking experiments from any compatible computer.

---

### Practical Learning

Bridge the gap between theoretical wireless communication concepts and real-world experimentation.

---

### Modularity

Each practical experiment is implemented independently, making future expansion straightforward.

---

### Interactive Education

Replace passive observation with hands-on experimentation and real-time analysis.

---

# Future Enhancements

Potential future improvements include:

- Practical 1–3 Integration
- Practical 10+ Expansion
- Live Signal Graphs
- Real-Time RSSI Charts
- Spectrum Analyzer
- Mobile Companion Application
- Experiment Report Generation (PDF)
- Student Login System
- Experiment History
- Instructor Dashboard
- Performance Analytics
- Cloud Deployment
- Multi-user Laboratory Sessions

---

# Technologies Summary

| Category | Technologies |
|----------|--------------|
| Frontend | React, Vite |
| Backend | FastAPI |
| APIs | REST |
| Programming | Python, JavaScript |
| Networking | Wi-Fi, Bluetooth |
| Styling | CSS3 |

---

# Vision Statement

The Wireless & Mobile Communication Virtual Lab redefines practical networking education by combining real hardware interaction, software simulations, and modern web technologies into an accessible virtual laboratory.

By integrating Wi-Fi analysis, Bluetooth communication, propagation studies, and interference visualization within a unified platform, the project provides students with a practical understanding of wireless communication systems while supporting modern hybrid and remote learning environments.

---

# Contributors

This project was collaboratively developed as part of an academic initiative by:

- **Om Tawde**
- **Parth Varekar**
- **Ishwar Suthar**

Each contributor played an important role in the design, development, testing, and documentation of the Wireless & Mobile Communication Virtual Lab.
