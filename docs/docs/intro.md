---
sidebar_position: 1
slug: /intro
---

# Introduction

**Parascope** is a sophisticated node-based engineering calculation platform designed to help engineers define, visualize, and solve complex system models.

## What is Parascope?

Parascope allows users to define complex engineering models using a **visual graph interface**, where nodes represent parameters, mathematical functions, or entire nested calculation sheets. It combines the intuitive nature of visual programming with the power of Python-based backend execution.

The platform is particularly suited for:
*   **System Engineering**: Modeling complex dependencies between subsystems.
*   **Trade Studies**: Performing parameter sweeps to understand design spaces.
*   **Rapid Prototyping**: Quickly building and testing calculation logic without writing boilerplate code.

## Key Features

*   **Visual Graph Editor**: Intuitive node-based interface built with [Rete.js](https://retejs.org/) for defining complex engineering logic.
*   **Python-Powered Calculations**: Secure backend execution engine runs Python code with support for `numpy`, `scipy`, and `networkx`.
*   **Nested Sheets**: Create reusable calculation modules (sheets) and import them into other sheets as single nodes, enabling modular system design.
*   **Advanced Trade Studies**: Perform parameter sweeps and visualize results with interactive Line, Bar, Scatter, and Timeline charts.
*   **AI Assistance**: Generate function logic from natural language using Google Gemini, OpenAI, or AWS Bedrock.
*   **Offline Execution**: Export sheets as standalone Python scripts that can be run offline using the `parascope-runtime` package.
*   **Secure Runtime**: Sandboxed execution environment using `RestrictedPython` with configurable module allow-lists.
*   **High Performance**: Optimized worker pool with module preloading and non-blocking architecture for responsive UI interactions.
*   **Real-time Evaluation**: Instant feedback on calculation results as you modify the graph.
