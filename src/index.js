const COMPATIBILITY_DATE = "2026-03-24";

const PROBLEMS = [
	{
		id: "contains-duplicate",
		title: "Contains Duplicate",
		difficulty: "Easy",
		functionName: "containsDuplicate",
		description:
			"Given an array of integers `nums`, return `true` if any value appears at least twice in the array, and return `false` if every element is distinct.",
		examples: [
			{
				input: "[1, 2, 3, 1]",
				output: "true",
			},
			{
				input: "[1, 2, 3, 4]",
				output: "false",
			},
		],
		constraints: [
			"1 <= nums.length <= 100000",
			"-1000000000 <= nums[i] <= 1000000000",
		],
		starterCode: `function containsDuplicate(nums) {
  // Write your solution here
}
`,
		tests: [
			{ input: [[1, 2, 3, 1]], expected: true },
			{ input: [[1, 2, 3, 4]], expected: false },
			{ input: [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]], expected: true },
			{ input: [[42]], expected: false },
			{ input: [[-1, -2, -3, -4, -1]], expected: true },
		],
	},
	{
		id: "product-except-self",
		title: "Product of Array Except Self",
		difficulty: "Medium",
		functionName: "productExceptSelf",
		description:
			"Given an integer array `nums`, return an array `answer` such that `answer[i]` is equal to the product of all elements of `nums` except `nums[i]`.",
		examples: [
			{
				input: "[1, 2, 3, 4]",
				output: "[24, 12, 8, 6]",
			},
			{
				input: "[-1, 1, 0, -3, 3]",
				output: "[0, 0, 9, 0, 0]",
			},
		],
		constraints: [
			"2 <= nums.length <= 100000",
			"-30 <= nums[i] <= 30",
			"The product of any prefix or suffix fits in a 32-bit integer.",
		],
		starterCode: `function productExceptSelf(nums) {
  // Write your solution here
}
`,
		tests: [
			{ input: [[1, 2, 3, 4]], expected: [24, 12, 8, 6] },
			{ input: [[-1, 1, 0, -3, 3]], expected: [0, 0, 9, 0, 0] },
			{ input: [[2, 3]], expected: [3, 2] },
			{ input: [[0, 4, 0]], expected: [0, 0, 0] },
			{ input: [[5, 1, 4, 2]], expected: [8, 40, 10, 20] },
		],
	},
	{
		id: "trapping-rain-water",
		title: "Trapping Rain Water",
		difficulty: "Hard",
		functionName: "trap",
		description:
			"Given `n` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.",
		examples: [
			{
				input: "[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]",
				output: "6",
			},
			{
				input: "[4, 2, 0, 3, 2, 5]",
				output: "9",
			},
		],
		constraints: [
			"1 <= height.length <= 20000",
			"0 <= height[i] <= 100000",
		],
		starterCode: `function trap(height) {
  // Write your solution here
}
`,
		tests: [
			{ input: [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], expected: 6 },
			{ input: [[4, 2, 0, 3, 2, 5]], expected: 9 },
			{ input: [[4, 2, 3]], expected: 1 },
			{ input: [[1, 0, 1]], expected: 1 },
			{ input: [[5, 4, 1, 2]], expected: 1 },
		],
	},
];

const PROBLEM_MAP = new Map(PROBLEMS.map((problem) => [problem.id, problem]));

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname === "/api/problems" && request.method === "GET") {
			return jsonResponse({ problems: PROBLEMS.map(toPublicProblem) });
		}

		if (url.pathname === "/api/submit" && request.method === "POST") {
			return handleSubmit(request, env);
		}

		return new Response("Not found", { status: 404 });
	},
};

async function handleSubmit(request, env) {
	const { problemId, code } = await request.json();
	const problem = PROBLEM_MAP.get(problemId);
	const cacheKey = `${problem.id}:${await hashText(code)}`;
	const moduleCode = `import { WorkerEntrypoint } from "cloudflare:workers";

export class Solution extends WorkerEntrypoint {
	async run(input) {
${code}
		return structuredClone(await ${problem.functionName}(...input));
	}
}`;
	const worker = env.LOADER.get(cacheKey, () => ({
		compatibilityDate: COMPATIBILITY_DATE,
		mainModule: "index.js",
		modules: {
			"index.js": moduleCode,
		},
		globalOutbound: null,
	}));
	const sandbox = worker.getEntrypoint("Solution");
	const startedAt = performance.now();

	const results = await Promise.all(
		problem.tests.map(async (test, index) => {
			try {
				const actual = await sandbox.run(test.input);
				return {
					test: index + 1,
					passed: sameResult(actual, test.expected),
					input: test.input,
					expected: test.expected,
					actual,
				};
			} catch (error) {
				return {
					test: index + 1,
					passed: false,
					input: test.input,
					expected: test.expected,
					error: error.message || "Execution failed.",
				};
			}
		}),
	);
	const isolateDurationMs = Math.round(performance.now() - startedAt);

	const passedCount = results.filter((result) => result.passed).length;

	return jsonResponse({
		passed: passedCount === problem.tests.length,
		passedCount,
		totalTests: problem.tests.length,
		isolateDurationMs,
		results,
	});
}

function toPublicProblem(problem) {
	return {
		id: problem.id,
		title: problem.title,
		difficulty: problem.difficulty,
		functionName: problem.functionName,
		description: problem.description,
		examples: problem.examples,
		constraints: problem.constraints,
		starterCode: problem.starterCode,
		totalTests: problem.tests.length,
	};
}

async function hashText(value) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function sameResult(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=UTF-8",
			"cache-control": "no-store",
		},
	});
}
