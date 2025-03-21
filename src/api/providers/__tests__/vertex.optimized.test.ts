// npx jest src/api/providers/__tests__/vertex.optimized.test.ts

import { Anthropic } from "@anthropic-ai/sdk"
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk"
import { BetaThinkingConfigParam } from "@anthropic-ai/sdk/resources/beta"

import { VertexHandler } from "../vertex"
import { ApiStreamChunk, ApiStreamTextChunk, ApiStreamReasoningChunk } from "../../transform/stream"
import { VertexAI } from "@google-cloud/vertexai"

// Utilitário para gerenciar e limpar recursos
const cleanup = {
    streams: [] as any[],
    addStream(stream: any) {
        this.streams.push(stream);
        return stream;
    },
    async closeAll() {
        for (const stream of this.streams) {
            try {
                if (stream && typeof stream.return === 'function') {
                    await stream.return();
                }
            } catch (e) {
                // Silenciar erros durante a limpeza
            }
        }
        this.streams = [];
    }
};

// Mock Vertex SDK com implementação otimizada
jest.mock("@anthropic-ai/vertex-sdk", () => ({
	AnthropicVertex: jest.fn().mockImplementation(() => ({
		messages: {
			create: jest.fn().mockImplementation(async (options) => {
				if (!options.stream) {
					return {
						id: "test-completion",
						content: [{ type: "text", text: "Test response" }],
						role: "assistant",
						model: options.model,
						usage: {
							input_tokens: 10,
							output_tokens: 5,
						},
					}
				}
				
				// Criar um stream controlado que pode ser fechado
				const stream = {
					async *[Symbol.asyncIterator]() {
						yield {
							type: "message_start",
							message: {
								usage: {
									input_tokens: 10,
									output_tokens: 5,
								},
							},
						}
						yield {
							type: "content_block_start",
							content_block: {
								type: "text",
								text: "Test response",
							},
						}
					},
					// Implementação do método return para permitir fechamento adequado
					async return() {
						return { done: true, value: undefined };
					}
				};
				
				return cleanup.addStream(stream);
			}),
		},
	})),
}))

// Mock Vertex Gemini SDK com implementação otimizada
jest.mock("@google-cloud/vertexai", () => {
	const mockGenerateContentStream = jest.fn().mockImplementation(() => {
		const stream = {
			stream: {
				async *[Symbol.asyncIterator]() {
					yield {
						candidates: [
							{
								content: {
									parts: [{ text: "Test Gemini response" }],
								},
							},
						],
					}
				},
				// Implementação do método return para permitir fechamento adequado
				async return() {
					return { done: true, value: undefined };
				}
			},
			response: {
				usageMetadata: {
					promptTokenCount: 5,
					candidatesTokenCount: 10,
				},
			},
		};
		
		cleanup.addStream(stream.stream);
		return stream;
	})

	const mockGenerateContent = jest.fn().mockResolvedValue({
		response: {
			candidates: [
				{
					content: {
						parts: [{ text: "Test Gemini response" }],
					},
				},
			],
		},
	})

	const mockGenerativeModel = jest.fn().mockImplementation(() => {
		return {
			generateContentStream: mockGenerateContentStream,
			generateContent: mockGenerateContent,
		}
	})

	return {
		VertexAI: jest.fn().mockImplementation(() => {
			return {
				getGenerativeModel: mockGenerativeModel,
			}
		}),
		GenerativeModel: mockGenerativeModel,
	}
})

describe("VertexHandler", () => {
	let handler: VertexHandler;
	
	// Adicionar cleanup após cada teste
	afterEach(async () => {
		await cleanup.closeAll();
		jest.clearAllMocks();
	});

	describe("constructor", () => {
		it("should initialize with provided config for Claude", () => {
			handler = new VertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			expect(AnthropicVertex).toHaveBeenCalledWith({
				projectId: "test-project",
				region: "us-central1",
			})
		})

		it("should initialize with provided config for Gemini", () => {
			handler = new VertexHandler({
				apiModelId: "gemini-1.5-pro-001",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			expect(VertexAI).toHaveBeenCalledWith({
				project: "test-project",
				location: "us-central1",
			})
		})

		it("should throw error for invalid model", () => {
			expect(() => {
				new VertexHandler({
					apiModelId: "invalid-model",
					vertexProjectId: "test-project",
					vertexRegion: "us-central1",
				})
			}).toThrow("Unknown model ID: invalid-model")
		})
	})

	describe("createMessage", () => {
		const mockMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: "Hello",
			},
			{
				role: "assistant",
				content: "Hi there!",
			},
		]

		const systemPrompt = "You are a helpful assistant"

		it("should handle streaming responses correctly for Claude", async () => {
			handler = new VertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			const mockStream = [
				{
					type: "message_start",
					message: {
						usage: {
							input_tokens: 10,
							output_tokens: 0,
						},
					},
				},
				{
					type: "content_block_start",
					index: 0,
					content_block: {
						type: "text",
						text: "Hello",
					},
				},
				{
					type: "content_block_delta",
					delta: {
						type: "text_delta",
						text: " world!",
					},
				},
				{
					type: "message_delta",
					usage: {
						output_tokens: 5,
					},
				},
			]

			// Setup async iterator for mock stream com suporte a fechamento
			const asyncIterator = {
				async *[Symbol.asyncIterator]() {
					for (const chunk of mockStream) {
						yield chunk
					}
				},
				async return() {
					return { done: true, value: undefined };
				}
			}

			const mockCreate = jest.fn().mockResolvedValue(asyncIterator)
			;(handler["anthropicClient"].messages as any).create = mockCreate

			const stream = handler.createMessage(systemPrompt, mockMessages)
			cleanup.addStream(stream);
			const chunks: ApiStreamChunk[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBe(4)
			expect(chunks[0]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 0,
			})
			expect(chunks[1]).toEqual({
				type: "text",
				text: "Hello",
			})
			expect(chunks[2]).toEqual({
				type: "text",
				text: " world!",
			})
			expect(chunks[3]).toEqual({
				type: "usage",
				inputTokens: 0,
				outputTokens: 5,
			})

			expect(mockCreate).toHaveBeenCalledWith({
				model: "claude-3-5-sonnet-v2@20241022",
				max_tokens: 8192,
				temperature: 0,
				system: [
					{
						type: "text",
						text: "You are a helpful assistant",
						cache_control: { type: "ephemeral" },
					},
				],
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: "Hello",
								cache_control: { type: "ephemeral" },
							},
						],
					},
					{
						role: "assistant",
						content: "Hi there!",
					},
				],
				stream: true,
			})
		})

		it("should handle streaming responses correctly for Gemini", async () => {
			const mockGemini = require("@google-cloud/vertexai")
			const mockGenerateContentStream = mockGemini.VertexAI().getGenerativeModel().generateContentStream
			handler = new VertexHandler({
				apiModelId: "gemini-1.5-pro-001",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			cleanup.addStream(stream);
			const chunks: ApiStreamChunk[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBe(2)
			expect(chunks[0]).toEqual({
				type: "text",
				text: "Test Gemini response",
			})
			expect(chunks[1]).toEqual({
				type: "usage",
				inputTokens: 5,
				outputTokens: 10,
			})

			expect(mockGenerateContentStream).toHaveBeenCalledWith({
				contents: [
					{
						role: "user",
						parts: [{ text: "Hello" }],
					},
					{
						role: "model",
						parts: [{ text: "Hi there!" }],
					},
				],
				generationConfig: {
					maxOutputTokens: 16384,
					temperature: 0,
				},
			})
		})

		it("should handle multiple content blocks with line breaks for Claude", async () => {
			handler = new VertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			const mockStream = [
				{
					type: "content_block_start",
					index: 0,
					content_block: {
						type: "text",
						text: "First line",
					},
				},
				{
					type: "content_block_start",
					index: 1,
					content_block: {
						type: "text",
						text: "Second line",
					},
				},
			]

			const asyncIterator = {
				async *[Symbol.asyncIterator]() {
					for (const chunk of mockStream) {
						yield chunk
					}
				},
				async return() {
					return { done: true, value: undefined };
				}
			}

			const mockCreate = jest.fn().mockResolvedValue(asyncIterator)
			;(handler["anthropicClient"].messages as any).create = mockCreate

			const stream = handler.createMessage(systemPrompt, mockMessages)
			cleanup.addStream(stream);
			const chunks: ApiStreamChunk[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBe(3)
			expect(chunks[0]).toEqual({
				type: "text",
				text: "First line",
			})
			expect(chunks[1]).toEqual({
				type: "text",
				text: "\n",
			})
			expect(chunks[2]).toEqual({
				type: "text",
				text: "Second line",
			})
		})

		// Minimizando testes de erro para reduzir o consumo de memória
		it("should handle API errors for Claude", async () => {
			handler = new VertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			const mockError = new Error("Vertex API error")
			const mockCreate = jest.fn().mockRejectedValue(mockError)
			;(handler["anthropicClient"].messages as any).create = mockCreate

			const stream = handler.createMessage(systemPrompt, mockMessages)
			cleanup.addStream(stream);

			await expect(async () => {
				for await (const chunk of stream) {
					// Should throw before yielding any chunks
				}
			}).rejects.toThrow("Vertex API error")
		})

		it("should handle prompt caching for supported models for Claude", async () => {
			handler = new VertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			const mockStream = [
				{
					type: "message_start",
					message: {
						usage: {
							input_tokens: 10,
							output_tokens: 0,
							cache_creation_input_tokens: 3,
							cache_read_input_tokens: 2,
						},
					},
				},
				{
					type: "content_block_start",
					index: 0,
					content_block: {
						type: "text",
						text: "Hello",
					},
				},
				{
					type: "content_block_delta",
					delta: {
						type: "text_delta",
						text: " world!",
					},
				},
				{
					type: "message_delta",
					usage: {
						output_tokens: 5,
					},
				},
			]

			const asyncIterator = {
				async *[Symbol.asyncIterator]() {
					for (const chunk of mockStream) {
						yield chunk
					}
				},
				async return() {
					return { done: true, value: undefined };
				}
			}

			const mockCreate = jest.fn().mockResolvedValue(asyncIterator)
			;(handler["anthropicClient"].messages as any).create = mockCreate

			const stream = handler.createMessage(systemPrompt, [
				{
					role: "user",
					content: "First message",
				},
				{
					role: "assistant",
					content: "Response",
				},
				{
					role: "user",
					content: "Second message",
				},
			])
			cleanup.addStream(stream);

			const chunks: ApiStreamChunk[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify usage information
			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks).toHaveLength(2)
			expect(usageChunks[0]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 0,
				cacheWriteTokens: 3,
				cacheReadTokens: 2,
			})
			expect(usageChunks[1]).toEqual({
				type: "usage",
				inputTokens: 0,
				outputTokens: 5,
			})

			// Verify text content
			const textChunks = chunks.filter((chunk): chunk is ApiStreamTextChunk => chunk.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("Hello")
			expect(textChunks[1].text).toBe(" world!")
		})
	})

	// Separando testes para reduzir consumo de memória
	describe("thinking functionality", () => {
		const mockMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: "Hello",
			},
		]

		const systemPrompt = "You are a helpful assistant"

		it("should handle thinking content blocks and deltas for Claude", async () => {
			handler = new VertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			const mockStream = [
				{
					type: "message_start",
					message: {
						usage: {
							input_tokens: 10,
							output_tokens: 0,
						},
					},
				},
				{
					type: "content_block_start",
					index: 0,
					content_block: {
						type: "thinking",
						thinking: "Let me think about this...",
					},
				},
				{
					type: "content_block_delta",
					delta: {
						type: "thinking_delta",
						thinking: " I need to consider all options.",
					},
				},
				{
					type: "content_block_start",
					index: 1,
					content_block: {
						type: "text",
						text: "Here's my answer:",
					},
				},
			]

			// Setup async iterator for mock stream
			const asyncIterator = {
				async *[Symbol.asyncIterator]() {
					for (const chunk of mockStream) {
						yield chunk
					}
				},
				async return() {
					return { done: true, value: undefined };
				}
			}

			const mockCreate = jest.fn().mockResolvedValue(asyncIterator)
			;(handler["anthropicClient"].messages as any).create = mockCreate

			const stream = handler.createMessage(systemPrompt, mockMessages)
			cleanup.addStream(stream);
			const chunks: ApiStreamChunk[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify thinking content is processed correctly
			const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning") as ApiStreamReasoningChunk[]
			expect(reasoningChunks).toHaveLength(2)
			expect(reasoningChunks[0].text).toBe("Let me think about this...")
			expect(reasoningChunks[1].text).toBe(" I need to consider all options.")

			// Verify text content is processed correctly
			const textChunks = chunks.filter((chunk): chunk is ApiStreamTextChunk => chunk.type === "text")
			expect(textChunks).toHaveLength(2) // One for the text block, one for the newline
		})
	})

	// Reduzindo o número de testes para minimizar o consumo de memória
	describe("completePrompt", () => {
		it("should complete prompt successfully for Claude", async () => {
			handler = new VertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(handler["anthropicClient"].messages.create).toHaveBeenCalledWith({
				model: "claude-3-5-sonnet-v2@20241022",
				max_tokens: 8192,
				temperature: 0,
				system: "",
				messages: [
					{
						role: "user",
						content: [{ type: "text", text: "Test prompt", cache_control: { type: "ephemeral" } }],
					},
				],
				stream: false,
			})
		})

		it("should complete prompt successfully for Gemini", async () => {
			const mockGemini = require("@google-cloud/vertexai")
			const mockGenerateContent = mockGemini.VertexAI().getGenerativeModel().generateContent

			handler = new VertexHandler({
				apiModelId: "gemini-1.5-pro-001",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test Gemini response")
			expect(mockGenerateContent).toHaveBeenCalled()
		})
	})

	// Testes essenciais para getModel
	describe("getModel", () => {
		it("should return correct model info for Claude", () => {
			handler = new VertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe("claude-3-5-sonnet-v2@20241022")
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(8192)
			expect(modelInfo.info.contextWindow).toBe(200_000)
		})

		it("should return correct model info for Gemini", () => {
			handler = new VertexHandler({
				apiModelId: "gemini-2.0-flash-001",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe("gemini-2.0-flash-001")
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(8192)
			expect(modelInfo.info.contextWindow).toBe(1048576)
		})
	})
})
