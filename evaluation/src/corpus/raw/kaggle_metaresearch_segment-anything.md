<!-- Snapshot of the Kaggle model card page, saved 2026-10-29 (page text only; view/download statistics omitted).
     The structured input in ../kaggle-segment-anything.json was typed from this page on 2026-10-06; this file is a later snapshot of the same page.
     Source: https://www.kaggle.com/models/metaresearch/segment-anything -->

# Segment Anything (metaresearch/segment-anything)

Meta · Published On 2023.04.05

Segment Anything Model (SAM) is a promptable segmentation system with zero-shot generalization to unfamiliar objects and images, without the need for additional training.

## Model Details

Meta AI Research, FAIR

Alexander Kirillov, Eric Mintun, Nikhila Ravi, Hanzi Mao, Chloe Rolland, Laura Gustafson, Tete Xiao, Spencer Whitehead, Alex Berg, Wan-Yen Lo, Piotr Dollar, Ross Girshick

[Paper] [Project] [Demo] [Dataset] [Blog]

The Segment Anything Model (SAM) produces high quality object masks from input prompts such as points or boxes, and it can be used to generate masks for all objects in an image. It has been trained on a dataset of 11 million images and 1.1 billion masks, and has strong zero-shot performance on a variety of segmentation tasks.

### Contributors

The Segment Anything project was made possible with the help of many contributors (alphabetical):

Aaron Adcock, Vaibhav Aggarwal, Morteza Behrooz, Cheng-Yang Fu, Ashley Gabriel, Ahuva Goldstand, Allen Goodman, Sumanth Gurram, Jiabo Hu, Somya Jain, Devansh Kukreja, Robert Kuo, Joshua Lane, Yanghao Li, Lilian Luong, Jitendra Malik, Mallika Malhotra, William Ngan, Omkar Parkhi, Nikhil Raina, Dirk Rowe, Neil Sejoor, Vanessa Stark, Bala Varadarajan, Bram Wasti, Zachary Winstrom

### Citing Segment Anything

If you use SAM or SA-1B in your research, please use the following BibTeX entry.

```
@article{kirillov2023segany,
title={Segment Anything},
author={Kirillov, Alexander and Mintun, Eric and Ravi, Nikhila and Mao, Hanzi and Rolland, Chloe and Gustafson, Laura and Xiao, Tete and Whitehead, Spencer and Berg, Alexander C. and Lo, Wan-Yen and Doll{\'a}r, Piotr and Girshick, Ross},
journal={arXiv:2304.02643},
year={2023}
}
```

## Tags and variation (page sidebar)

- Tags: Image Segmentation, Image
- Model variations: PyTorch, variation vit-b, Version 1
- Fine-Tunable: No
- License: Apache 2.0
- Variation description: ViT-B is the smallest variation with 91M parameters

### Example Use

Install Segment Anything:

```
pip install git+https://github.com/facebookresearch/segment-anything.git
```

Get masks from a given prompt:

```python
from segment_anything import SamPredictor, sam_model_registry
sam = sam_model_registry["vit_b"](checkpoint="/kaggle/input/segment-anything/pytorch/vit-b/1/model.pth")
predictor = SamPredictor(sam)
predictor.set_image(<your_image>)
masks, _, _ = predictor.predict(<input_prompts>)
```

Or generate masks for an entire image:

```python
from segment_anything import SamAutomaticMaskGenerator, sam_model_registry
sam = sam_model_registry["vit_b"](checkpoint="/kaggle/input/segment-anything/pytorch/vit-b/1/model.pth")
mask_generator = SamAutomaticMaskGenerator(sam)
masks = mask_generator.generate(<your_image>)
```

Files: model.pth (375.04 MB).
