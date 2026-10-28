<!-- Snapshot of the Google Cloud Model Garden page (Overview tab), saved 2026-10-29 (page text only).
     The structured input in ../mg-gemini-robotics-er-2.json was typed from this page on 2026-10-06; this file is a later snapshot of the same page.
     Source: https://console.cloud.google.com/agent-platform/publishers/google/model-garden/gemini-robotics-er-2-preview-info -->

# Gemini Robotics ER 2

Gemini Robotics ER 2 is a vision-language model (VLMs) that lets robots perceive and interact with the physical world.

## Overview

Introducing Gemini Robotics ER 2 - our most capable “embodied reasoning” model for robotics. Think of Gemini Robotics ER 2 as a high-level brain for robots. It allows robots to chat with humans, understand the physical world, and plan multi-step tasks. It then hands off motor execution to any given lower level vision-language-action (VLA) model. Gemini Robotics ER 2 can also natively call tools like Google Search to find information, or any other user-defined function.

The Gemini Robotics ER 2 model is now available in Private Preview on Gemini Enterprise Agent Platform (Vertex AI).

The Gemini Robotics ER Preview is subject to the "Pre-GA Offerings Terms" in the General Service Terms section of the Service Specific Terms, and the Additional Terms for Generative AI Preview Products. Pre-GA products and features are available "as is" and might have limited support. For more information, see the launch stage descriptions. Please review the customer documentation for pre-GA offerings for additional restrictions.

Access: This model is in Private Preview; contact your Google team to have your project allowlisted.

Gemini Robotics ER 2 is also available through our Gen AI SDK that provides a unified interface for Google AI Studio and Agent Platform in Python, Go, JavaScript, Java, and .NET.

Gemini Robotics ER 2 is an update to our reasoning model that enables robots to understand their environments precisely. It specializes in embodied reasoning capabilities, such as agentic orchestration of robots (e.g. using VLAs), robot video understanding including progress understanding and success detection, instrument reading, pointing, and spatial reasoning.

### Model details

The model details are as follows:

| Property | Description |
|---|---|
| Model ID | gemini-robotics-er-2-preview |
| Supported data types | Inputs: Text / Image / Video / Audio (interleaving possible). Output: Text |
| Token limits | Input token limit: 128k. Output token limit: 64k |
| Launch stage | Private Preview |

### Capabilities

Gemini Robotics ER 2 specializes in the core reasoning that robots need to operate in the physical world:

| Capability | Description |
|---|---|
| Spatial reasoning | Point to objects, track them in video, detect with bounding boxes, plan trajectories. |
| Agentic Vision | Combine visual reasoning with code execution to inspect and manipulate images step-by-step, grounding answers in visual evidence. |
| Task orchestration | Combine spatial reasoning with custom robot APIs to complete long-horizon tasks. |
| Video understanding | Moment finding and progress classification from continuous video feeds. |

### Intended usage and safety

While Gemini Robotics ER was built with safety in mind, it is your responsibility to maintain a safe environment around the robot. Generative AI models can make mistakes, and physical robots can cause damage. To learn more, visit Google DeepMind robotics safety page.

## Documentation

### Get started

The example below finds objects in an image and returns their normalized 2D coordinates and labels. You can pass this output directly to a robotics API or a VLA model to generate robot actions.

Before you begin: Enable the Agent Platform API. For more information on getting set up on Google Cloud, see Get set up on Google Cloud.

### Try Gemini Robotics ER 2 (curl)

To use Gemini Robotics ER 2 with the command line interface (CLI), do the following:

1. Open Cloud Shell or a local terminal window with the gcloud CLI installed.
2. Configure environment variables by entering the following. Replace YOUR_PROJECT_ID with the ID of your Google Cloud project.

```
MODEL_ID="gemini-robotics-er-2-preview"
PROJECT_ID="YOUR_PROJECT_ID"
```

3. Send a prompt request by entering the following curl command. This example asks the model to point to objects in an image and return their normalized 2D coordinates:

```
curl \
-X POST \
-H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
-H "Content-Type: application/json" \
https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/publishers/google/models/${MODEL_ID}:streamGenerateContent -d \
$'{
"contents": {
"role": "user",
"parts": [
{
"fileData": {
"mimeType": "image/jpeg",
"fileUri": "gs://generativeai-downloads/images/scones.jpg"
}
},
{
"text": "Point to no more than 10 items in the image. The answer should follow the json format: [{\\"point\\": <point>, \\"label\\": <label>}, ...]. The points are in [y, x] format normalized to 0-1000."
}
]
}
}'
```

For more information, see the Gemini API reference.

### Try Gemini Robotics ER 2 (Python)

Before trying this sample, follow the Python setup instructions in the Google Gen AI SDK quickstart using client libraries. To authenticate to Agent Platform, set up Application Default Credentials. For more information, see Set up authentication for a local development environment.

Install or update the Google Gen AI SDK. You can also install it in a virtual environment.

```
pip3 install --upgrade --user google-genai
```

Send a prompt request. Replace YOUR_PROJECT_ID with your Google Cloud project ID.

```python
from google import genai
from google.genai import types
client = genai.Client(
enterprise=True, project="YOUR_PROJECT_ID", location="global",
)
# If your image is stored in Google Cloud Storage, you can use the from_uri class method to create a Part object.
IMAGE_URI = "gs://generativeai-downloads/images/scones.jpg"
model = "gemini-robotics-er-2-preview"
PROMPT = """
Point to no more than 10 items in the image. The label returned should be an
identifying name for the object detected. The answer should follow the json
format: [{"point": <point>, "label": <label>}, ...]. The points are in [y, x]
format normalized to 0-1000.
"""
response = client.models.generate_content(
model=model,
contents=[
PROMPT,
types.Part.from_uri(
file_uri=IMAGE_URI,
mime_type="image/jpeg",
),
],
# Use a small thinking budget for low-latency spatial tasks like pointing, or a
# larger budget for more complex reasoning such as counting.
config=types.GenerateContentConfig(
thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.HIGH),
),
)
print(response.text, end="")
```

The model returns a JSON array of points, each with normalized [y, x] coordinates and a label, for example:

```
[
{"point": [376, 508], "label": "scone"},
{"point": [287, 609], "label": "spoon"},
{"point": [223, 303], "label": "bowl of berries"}
]
```

For more information, see the Google Gen AI SDK reference. For more examples refer to the Google DeepMind documentation on Gemini Robotics ER 2 model.

### Versions

| Resource ID | Version | Release stage | Description |
|---|---|---|---|
| gemini-robotics-er-2-preview | 2 | Private Preview | Vision-language embodied reasoning for robotics. |

- Model ID: publishers/google/models/gemini-robotics-er-2-preview-info
- Version name: google/gemini-robotics-er-2-preview-info
- Tags: Task: Generation, Extraction, Recognition
