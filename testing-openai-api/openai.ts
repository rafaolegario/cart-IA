import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import z from "zod";
import { produtosEmEstoque, produtosEmFalta, setEmbedding, todosProdutos } from "./database";
import { ChatCompletionMessageParam } from "openai/resources";

const schema = z.object({
  produtos: z.array(z.string()),
  message: z.string()
});

const apiKey =
  process.env.OPENAI_KEY

const client = new OpenAI({
  apiKey,
});

export const generateProducts = async ({ prompt }: { prompt: string }) => {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "developer",
      content: `Liste no maximo 3 produtos que atendam a necessidade do usuário. Apenas os que estão em estoque. Caso um item não exista no banco de dados, gere uma mensagem educada avisando que não tem esse item, caso tiver produtos gere uma mensagem educada incentivando a compra e agradecendo`,
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  const generateCompletion = async (messages: ChatCompletionMessageParam[]) => {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 150,
      temperature: 0.9,
      response_format: zodResponseFormat(schema, "produtos_schema"),
      tools: [
        {
          type: "function",
          function: {
            name: "produtos_em_estoque",
            description: "Lista apenas os produtos que estão em estoque",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "produtos_em_falta",
            description:
              "Lista apenas os produtos que estão em falta no estoque",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        },
      ],
      messages,
    });

    if (completion.choices[0].message.refusal) {
      throw new Error("Ocorreu um erro com a geração da resposta");
    }

     const { tool_calls } = completion.choices[0].message;

  if (tool_calls) {
    const [tool_call] = tool_calls;

    const toolsMap = {
      produtos_em_falta: produtosEmFalta,
      produtos_em_estoque: produtosEmEstoque,
    };

    if (!(tool_call.type === "function"))
      throw new Error("Erro ao buscar tipo da tool call");

    const functionCall  = toolsMap[tool_call.function.name];

    if (!functionCall) {
      throw new Error(" Funçao nao encontrada");
    }

    const result = functionCall();
    messages.push(completion.choices[0].message);

    messages.push({
      role: "tool",
      tool_call_id: tool_call.id,
      content: result.toString(),
    });

    return await generateCompletion(messages)
    
  }

    return completion.choices[0];
  };

  const completion = await generateCompletion(messages);

  return JSON.parse(completion.message.content ?? "");
};

export const generateEmbedding = async (input: string) =>{
  const response = await client.embeddings.create({
    input,
    model: "text-embedding-3-small"
  })

  return response.data[0].embedding ?? null
}

export const embedProducts = async () => {
  const products = todosProdutos()

  await Promise.allSettled(products.map(async (p, index) =>{
    const embedding = await generateEmbedding(`${p.nome}: ${p.descricao}`)
    if(!embedding) return
    setEmbedding({index, embedding})
  }))
}