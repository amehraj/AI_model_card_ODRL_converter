<!-- Snapshot of the Kaggle model card page, saved 2026-10-29 (page text only; view/download statistics omitted).
     The structured input in ../kaggle-perch.json was typed from this page on 2026-10-06. The card has since been updated: it describes Perch 2.0 (perch_v2, version 2), so this snapshot may differ from the text that was used.
     Source: https://www.kaggle.com/models/google/bird-vocalization-classifier -->

# Perch (google/bird-vocalization-classifier)

Google · Published On 2023.02.24

Google Bird Vocalization Classifier: A global bird embedding and classification model.

## Model Details

Perch is a bioacoustics model trained to classify nearly 15,000 species and generate audio embeddings that are useful for a variety of downstream applications (such as individual identification or estimating coral reef health). It has been used to detect critically endangered birds and power audio search engines.

The current model (Perch 2.0) is an update to our original Perch model with improved embedding and prediction quality, as well as support for many new (non-avian) taxa. The model was trained on a combination of publicly available audio from Xeno-Canto, iNaturalist, Animal Sound Archive, and FSD50k: If you like this model, consider recording some interesting audio and contributing it to a public source!

Perch makes predictions for most bird species as well as a variety of frogs, crickets, grasshoppers and mammals. But note that the output logits for species are uncalibrated and possibly unreliable for rare species, and we recommend that you use your own data to tune detection thresholds.

The embeddings were trained with the goal of being linearly separable. For most cases training a simple linear classifier on top of the model’s outputs should work well. For most bioacoustics applications we recommend using an agile modelling (human-annotator-in-the-loop) workflow.

### Model Quality

The Perch 2.0 model was evaluated on a variety of tasks and domains: species classification in avian soundscapes, call type and dialect recognition, individual identification of dogs and bats, event detection in coral reefs, etc. It achieves state-of-the-art scores on bioacoustics benchmarks such as BirdSet and BEANS. See our paper for more details.

### Model Description

Perch 2.0’s embedding model is based on an EfficientNet-B3 architecture with approximately 12 million parameters. The species classification head adds an additional 91 million parameters (due to the large number of classes).

The model outputs 1536-dimensional embeddings. It is also possible to retrieve the embeddings before spatial pooling. These have dimensions (5, 3, 1536).

### License

Copyright 2025 Google, LLC

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

## Tags and variation (page sidebar)

- Tags: Audio Event Classification, EfficientNet, Earth and Nature, Animals, Signal Processing (2 more)
- Model variations: TensorFlow 2, variation perch_v2, Version 2
- Fine-Tunable: No
- License: Apache 2.0
- Model Variation Type: Base model

### Model Description (variation perch_v2)

Important notes on model variants!

This version of the model requires Tensorflow >=2.20 and a GPU.
The perch_v2_cpu variant will run on a CPU.
justinchuby has also provided ONNX and TFLite conversions of the Perch 2.0 model.

Perch 2.0’s embedding model is based on an EfficientNet-B3 architecture with approximately 12 million parameters. The species classification head adds an additional 91 million parameters (due to the large number of classes).

The model was trained with a softmax head, but the softmax operation is not applied at inference time. A side effect is that the scores produced by the model tend to look 'big' relative to models trained with binary cross entropy. As with any classifier, higher model scores indicate more model confidence, but the precise scale and bias can change from one species to another.

The model consumes 5-second segments of audio sampled at 32kHz. For audio with other sample rates, you can try resampling, pitch shifting (which has worked well for bats in some cases), or feeding in the audio in its native sample rate as an array of 160,000 values.

The model outputs include:

- The spectrogram computed from the input audio.
- A 1536-dimensional embedding,
- A spatial_embedding consisting of un-pooled embeddings, with shape (16, 4, 1536).
- Logit predictions for ~15,000 classes, of which ~10,000 are birds. The predicted classes are detailed in the assets/labels.csv file, following the iNaturalist taxonomy. An additional set of conversions to eBird six-letter codes is also provided in assets/perch_v2_ebird_classes.csv.

Versions:

1. Original release.
2. Same as original release, but fixes a directory structure issue which was causing TFHub to fail to load the model in some environments.

### Example Use

While the models may be used as standard TF SavedModels, we suggest using our Perch Hoplite inference wrappers. These will automatically load label class lists, and facilitate restriction to species subsets. Audio framing is also handled automatically.

Using Perch Hoplite:

```python
!pip install git+https://github.com/google-research/perch-hoplite.git
!pip install tensorflow[and-cuda]~=2.20.0

from perch_hoplite.zoo import model_configs

# Input: 5 seconds of silence as mono 32 kHz waveform samples.
waveform = np.zeros(5 * 32000, dtype=np.float32)

# Automatically downloads the model from Kaggle.
# If no GPU, try 'perch_v2_cpu'
model = model_configs.load_model_by_name('perch_v2')

outputs = model.embed(waveform)
# do something with outputs.embeddings and outputs.logits['label']
```

Using TFHub:

```python
!pip install tensorflow[and-cuda]~=2.20.0

from matplotlib import pyplot as plt
import numpy as np
import tensorflow_hub as hub
import tensorflow as tf
tf.experimental.numpy.experimental_enable_numpy_behavior()

# Load the model.
model = hub.load('https://www.kaggle.com/models/google/bird-vocalization-classifier/tensorFlow2/perch_v2/2')

# Input: 5 seconds of silence as mono 32 kHz waveform samples.
waveform = np.random.uniform(-1, 1, 5 * 32000).astype(np.float32)

# Run the model, check the output.
model_outputs = model.signatures['serving_default'](inputs=waveform[np.newaxis, :])

# Examine the spectrogram.
plt.imshow(model_outputs['spectrogram'][0].T)

# Examine the embeddings.
print(model_outputs['embedding'].shape)
print(model_outputs['spatial_embedding'].shape)

# Examine the logits.
print(model_outputs['label'].shape)
```

Files: fingerprint.pb, saved_model.pb, assets/, variables/ (410.28 MB).
