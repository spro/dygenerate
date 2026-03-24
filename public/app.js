const problemSelect = document.getElementById("problem-select");
const problemTitle = document.getElementById("problem-title");
const problemDifficulty = document.getElementById("problem-difficulty");
const problemDescription = document.getElementById("problem-description");
const problemExamples = document.getElementById("problem-examples");
const problemConstraints = document.getElementById("problem-constraints");
const problemTests = document.getElementById("problem-tests");
const codeEditor = document.getElementById("code-editor");
const runButton = document.getElementById("run-button");
const resultsSummary = document.getElementById("results-summary");
const resultsOutput = document.getElementById("results-output");

let problems = [];
let currentProblemId = "";
const savedCode = new Map();

bootstrap().catch((error) => {
	resultsSummary.textContent = "Unable to load problems.";
	renderMessage(error.message || "Unknown error while loading problems.");
});

async function bootstrap() {
	const response = await fetch("/api/problems");
	const data = await response.json();

	problems = data.problems ?? [];
	if (problems.length === 0) {
		resultsSummary.textContent = "No problems available.";
		return;
	}

	problemSelect.innerHTML = "";
	for (const problem of problems) {
		const option = document.createElement("option");
		option.value = problem.id;
		option.textContent = `${problem.difficulty} - ${problem.title}`;
		problemSelect.append(option);
	}

	currentProblemId = problems[0].id;
	renderProblem(currentProblemId);

	problemSelect.addEventListener("change", () => {
		persistCurrentCode();
		currentProblemId = problemSelect.value;
		renderProblem(currentProblemId);
	});

	runButton.addEventListener("click", runTests);
	codeEditor.addEventListener("input", () => {
		savedCode.set(currentProblemId, codeEditor.value);
	});
}

function renderProblem(problemId) {
	const problem = problems.find((item) => item.id === problemId);
	if (!problem) {
		return;
	}

	problemSelect.value = problem.id;
	problemTitle.textContent = problem.title;
	problemDifficulty.textContent = problem.difficulty;
	problemDifficulty.className = `difficulty-badge difficulty-${problem.difficulty.toLowerCase()}`;
	problemDescription.textContent = problem.description;
	problemTests.textContent = `${problem.totalTests} hidden tests run against your JavaScript function.`;

	problemExamples.innerHTML = "";
	for (const [index, example] of problem.examples.entries()) {
		const card = document.createElement("div");
		card.className = "example-card";
		card.innerHTML = `
			<p><strong>Example ${index + 1}</strong></p>
			<p><span class="result-label">Input:</span> ${escapeHtml(example.input)}</p>
			<p><span class="result-label">Output:</span> ${escapeHtml(example.output)}</p>
		`;
		problemExamples.append(card);
	}

	problemConstraints.innerHTML = "";
	for (const constraint of problem.constraints) {
		const item = document.createElement("li");
		item.textContent = constraint;
		problemConstraints.append(item);
	}

	codeEditor.value = savedCode.get(problem.id) ?? problem.starterCode;
	resultsSummary.textContent = "Choose your approach, then run the tests.";
	resultsOutput.innerHTML = "";
}

async function runTests() {
	const code = codeEditor.value.trim();
	if (!code) {
		resultsSummary.textContent = "Code is required.";
		renderMessage("Add a JavaScript solution before running tests.");
		return;
	}

	runButton.disabled = true;
	resultsSummary.textContent = "Running tests...";
	renderMessage("Executing your code inside a Dynamic Worker...");

	try {
		const response = await fetch("/api/submit", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				problemId: currentProblemId,
				code,
			}),
		});

		const payload = await response.json();
		if (!response.ok) {
			throw new Error(payload.error || "Submission failed.");
		}

		resultsSummary.textContent = `Passed ${payload.passedCount}/${payload.totalTests} tests in ${payload.isolateDurationMs}ms inside isolates.`;
		renderResults(payload.results ?? []);
	} catch (error) {
		resultsSummary.textContent = "Submission failed.";
		renderMessage(error.message || "Unknown submission error.");
	} finally {
		runButton.disabled = false;
	}
}

function renderResults(results) {
	resultsOutput.innerHTML = "";

	for (const result of results) {
		const card = document.createElement("div");
		card.className = `result-card ${result.passed ? "pass" : "fail"}`;

		const parts = [
			`<p><span class="result-label">Test ${result.test}:</span> ${result.passed ? "Passed" : "Failed"}</p>`,
			`<p><span class="result-label">Input:</span> ${escapeHtml(JSON.stringify(result.input))}</p>`,
			`<p><span class="result-label">Expected:</span> ${escapeHtml(JSON.stringify(result.expected))}</p>`,
		];

		if (result.error) {
			parts.push(
				`<p><span class="result-label">Error:</span> ${escapeHtml(result.error)}</p>`,
			);
		} else {
			parts.push(
				`<p><span class="result-label">Actual:</span> ${escapeHtml(JSON.stringify(result.actual))}</p>`,
			);
		}

		card.innerHTML = parts.join("");
		resultsOutput.append(card);
	}
}

function renderMessage(message) {
	resultsOutput.innerHTML = "";
	const card = document.createElement("div");
	card.className = "result-card";
	card.innerHTML = `<p>${escapeHtml(message)}</p>`;
	resultsOutput.append(card);
}

function persistCurrentCode() {
	if (currentProblemId) {
		savedCode.set(currentProblemId, codeEditor.value);
	}
}

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
