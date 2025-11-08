import express from 'express'
import { Request, Response } from "express";
import { embedProducts, generateEmbedding, generateProducts } from "./openai";
import { produtosSimilares, todosProdutos } from './database';

const app = express()
app.use(express.json())

app.post("/generate", async (req: Request, res: Response) => {
  const { prompt } = req.body;

  try {
    const response = await generateProducts({ prompt });
    res.status(200);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: "Erro interno no servidor", erro:error  });
  }
});

app.post("/cart", async (req, res) => {
  const { message } = req.body;
  const embedding = await generateEmbedding(message);
  if (!embedding) {
    res.status(500).json({ error: 'Embedding não gerada' });
    return;
  }
  const produtos = produtosSimilares(embedding);
  res.json(produtos.map(p => ({ nome: p.nome, similaridade: p.similaridade })));
});


app.post("/embeddings", async (req:Request, res: Response) => {

  try {
    await embedProducts()
    console.log(todosProdutos())
    res.status(200).end();
    
  } catch (error) {
    res.status(500).json({ error: "Erro interno no servidor", erro:error  });
  }
});
export default app