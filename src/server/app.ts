import { isContentLanguage } from '../i18n/locales.js';
import express from "express";
import {
  generateStory,
  chatWithCharacter,
  generateCharacterImage,
  editCharacterImageExpression,
  generateSceneBackground,
  generateSceneDialogue,
  generateRecursiveInitial,
  generateRecursiveNextStep,
  summarizeStoryToNovel,
  generateStoryProposals
} from '../services/geminiService.js';

import { installApiProtection } from './protection.js';
import { isImageGenerationEnabled, IMAGE_GENERATION_DISABLED } from '../services/imageGenerationPolicy.js';

export function createApiApp(hosted = false) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  // Middlewares for big payload processing (e.g. base64 images)
  app.use(express.json({ limit: hosted ? '4mb' : '100mb' }));
  app.use(express.urlencoded({ limit: hosted ? '4mb' : '100mb', extended: true }));

  // Optional language option: old clients without it retain Korean output.
  app.use('/api/gemini', (req, res, next) => {
    if (req.body?.contentLanguage !== undefined && !isContentLanguage(req.body.contentLanguage)) {
      res.status(400).json({ error: 'Unsupported contentLanguage. Use ko, ja, or en.' });
      return;
    }
    next();
  });

  // API routes health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  // Fail before provider-key checks, shared Redis admission, or any image route.
  app.use('/api/gemini', (req, res, next) => {
    const operation = req.path.replace(/\/+$/, '').toLowerCase();
    if (['/generatecharacterimage', '/editcharacterimageexpression', '/generatescenebackground'].includes(operation)
        && !isImageGenerationEnabled()) {
      res.status(403).json({ error: 'AI image generation is disabled.', code: IMAGE_GENERATION_DISABLED });
      return;
    }
    next();
  });
  installApiProtection(app, hosted);

  // 1. generateStory
  app.post("/api/gemini/generateStory", async (req, res) => {
    if (req.body.generationProfile !== undefined && !['full', 'quick'].includes(req.body.generationProfile)) {
      res.status(400).json({ error: 'Unsupported generationProfile.' });
      return;
    }
    if (req.body.generationProfile === 'quick' && (typeof req.body.theme !== 'string' || !req.body.theme.trim() || req.body.theme.length > 500)) {
      res.status(400).json({ error: 'Quick idea must contain 1–500 characters.' });
      return;
    }
    try {
      const { theme } = req.body;
      const result = await generateStory(theme, { contentLanguage: req.body.contentLanguage, generationProfile: req.body.generationProfile });
      res.json(result);
    } catch (err: any) {
      console.error("API error /generateStory (details omitted)");
      res.status(500).send(hosted ? "AI request failed. Retry or use the demo." : err.message || "Error generating story");
    }
  });

  // 2. chatWithCharacter
  app.post("/api/gemini/chatWithCharacter", async (req, res) => {
    try {
      const { character, scenePrompt, userInput, history } = req.body;
      const result = await chatWithCharacter(character, scenePrompt, userInput, history, { contentLanguage: req.body.contentLanguage });
      res.json(result);
    } catch (err: any) {
      console.error("API error /chatWithCharacter (details omitted)");
      res.status(500).send(hosted ? "AI request failed. Retry or use the demo." : err.message || "Error chatting with character");
    }
  });

  // 3. generateCharacterImage
  app.post("/api/gemini/generateCharacterImage", async (req, res) => {
    if (req.body.generationProfile === 'quick' &&
        !['characterName', 'characterPrompt', 'expressionName'].every(key => typeof req.body[key] === 'string' && req.body[key].trim() && req.body[key].length <= 2000)) {
      res.status(400).json({ error: 'Invalid Quick character image input.' }); return;
    }
    try {
      const { characterName, characterPrompt, expressionName } = req.body;
      const result = await generateCharacterImage(characterName, characterPrompt, expressionName, { generationProfile: req.body.generationProfile });
      res.json({ result });
    } catch (err: any) {
      console.error("API error /generateCharacterImage (details omitted)");
      res.status(500).send(hosted ? "AI request failed. Retry or use the demo." : err.message || "Error generating character image");
    }
  });

  // 4. editCharacterImageExpression
  app.post("/api/gemini/editCharacterImageExpression", async (req, res) => {
    try {
      const { baseImage, targetExpressionName, characterName, characterPrompt } = req.body;
      const result = await editCharacterImageExpression(baseImage, targetExpressionName, characterName, characterPrompt);
      res.json({ result });
    } catch (err: any) {
      console.error("API error /editCharacterImageExpression (details omitted)");
      res.status(500).send(hosted ? "AI request failed. Retry or use the demo." : err.message || "Error editing character expression");
    }
  });

  // 5. generateSceneBackground
  app.post("/api/gemini/generateSceneBackground", async (req, res) => {
    if (req.body.generationProfile === 'quick' && (typeof req.body.prompt !== 'string' || !req.body.prompt.trim() || req.body.prompt.length > 2000)) {
      res.status(400).json({ error: 'Invalid Quick background input.' }); return;
    }
    try {
      const { prompt } = req.body;
      const result = await generateSceneBackground(prompt, { generationProfile: req.body.generationProfile });
      res.json({ result });
    } catch (err: any) {
      console.error("API error /generateSceneBackground (details omitted)");
      res.status(500).send(hosted ? "AI request failed. Retry or use the demo." : err.message || "Error generating scene background");
    }
  });

  // 6. generateSceneDialogue
  app.post("/api/gemini/generateSceneDialogue", async (req, res) => {
    try {
      const { sceneName, scenePrompt, presentCharacters } = req.body;
      const result = await generateSceneDialogue(sceneName, scenePrompt, presentCharacters, { contentLanguage: req.body.contentLanguage });
      res.json(result);
    } catch (err: any) {
      console.error("API error /generateSceneDialogue (details omitted)");
      res.status(500).send(hosted ? "AI request failed. Retry or use the demo." : err.message || "Error generating scene dialogue");
    }
  });

  // 7. generateRecursiveInitial
  app.post("/api/gemini/generateRecursiveInitial", async (req, res) => {
    try {
      const { theme } = req.body;
      const result = await generateRecursiveInitial(theme, { contentLanguage: req.body.contentLanguage });
      res.json(result);
    } catch (err: any) {
      console.error("API error /generateRecursiveInitial (details omitted)");
      res.status(500).send(hosted ? "AI request failed. Retry or use the demo." : err.message || "Error generating recursive initial");
    }
  });

  // 8. generateRecursiveNextStep
  app.post("/api/gemini/generateRecursiveNextStep", async (req, res) => {
    try {
      const { theme, currentVN, nextStage, userChoice } = req.body;
      const result = await generateRecursiveNextStep(theme, currentVN, nextStage, userChoice, { contentLanguage: req.body.contentLanguage });
      res.json(result);
    } catch (err: any) {
      console.error("API error /generateRecursiveNextStep (details omitted)");
      res.status(500).send(hosted ? "AI request failed. Retry or use the demo." : err.message || "Error generating recursive next step");
    }
  });

  // 9. summarizeStoryToNovel
  app.post("/api/gemini/summarizeStoryToNovel", async (req, res) => {
    try {
      const { vn } = req.body;
      const result = await summarizeStoryToNovel(vn, { contentLanguage: req.body.contentLanguage });
      res.json({ result });
    } catch (err: any) {
      console.error("API error /summarizeStoryToNovel (details omitted)");
      res.status(500).send(hosted ? "AI request failed. Retry or use the demo." : err.message || "Error summarizing story to novel");
    }
  });

  // 10. generateStoryProposals
  app.post("/api/gemini/generateStoryProposals", async (req, res) => {
    try {
      const { genre, keyword } = req.body;
      const result = await generateStoryProposals(genre, keyword, { contentLanguage: req.body.contentLanguage });
      res.json(result);
    } catch (err: any) {
      console.error("API error /generateStoryProposals (details omitted)");
      res.status(500).send(hosted ? "AI request failed. Retry or use the demo." : err.message || "Error generating story proposals");
    }
  });

  app.use('/api', (_req, res) => { res.status(404).json({ error: 'API route not found.' }); });
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err?.type === 'entity.too.large' ? 413 : 400;
    res.status(status).json({ error: status === 413 ? 'Request payload too large.' : 'Invalid JSON request.' });
  });
  return app;
}
