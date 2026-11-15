import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSuperscript, faSliders, faShapes, faBookOpen, faKeyboard,
  faCode, faCopy, faDownload, faTriangleExclamation, faEraser
} from "@fortawesome/free-solid-svg-icons";
import katex from "katex";
import Nav from "../../../../helpers/Nav.jsx";
import Dropdown from "../../../../helpers/Dropdown.jsx";
import useAuth from "../../../../UseAuth.jsx";
import "../../../../styles/mainStyles/Toolkit/Utilities/Latex/Latex.css";
import "../../../../styles/helperStyles/LoadingSpinner.css";
import "katex/dist/katex.min.css";

const TEMPLATES = [
  { label: "Fraction", snippet: "\\frac{a}{b}" },
  { label: "Square Root", snippet: "\\sqrt{x}" },
  { label: "Nth Root", snippet: "\\sqrt[n]{x}" },
  { label: "Power", snippet: "x^{n}" },
  { label: "Subscript", snippet: "x_{i}" },
  { label: "Sum", snippet: "\\sum_{i=1}^{n} x_i" },
  { label: "Product", snippet: "\\prod_{i=1}^{n} x_i" },
  { label: "Integral", snippet: "\\int_{a}^{b} f(x)\\,dx" },
  { label: "Limit", snippet: "\\lim_{x \\to \\infty} f(x)" },
  { label: "Derivative", snippet: "\\frac{d}{dx} f(x)" },
  { label: "Partial", snippet: "\\frac{\\partial f}{\\partial x}" },
  { label: "Binomial", snippet: "\\binom{n}{k}" },
  { label: "Matrix", snippet: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}" },
  { label: "Determinant", snippet: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}" },
  { label: "Cases", snippet: "f(x) = \\begin{cases} x & x \\geq 0 \\\\ -x & x < 0 \\end{cases}" },
  { label: "Aligned", snippet: "\\begin{aligned} a &= b + c \\\\ &= d \\end{aligned}" },
  { label: "Mean", snippet: "\\bar{x}" },
  { label: "Estimate", snippet: "\\hat{\\beta}" },
  { label: "Vector", snippet: "\\vec{v}" },
  { label: "Text", snippet: "\\text{text}" }
];

const EXAMPLES = [
  { label: "Quadratic", source: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
  { label: "Normal PDF", source: "f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}" },
  { label: "t Statistic", source: "t = \\frac{\\bar{x}_1 - \\bar{x}_2}{\\sqrt{\\frac{s_1^2}{n_1} + \\frac{s_2^2}{n_2}}}" },
  { label: "Pearson r", source: "r = \\frac{\\sum_{i=1}^{n}(x_i - \\bar{x})(y_i - \\bar{y})}{\\sqrt{\\sum_{i=1}^{n}(x_i - \\bar{x})^2}\\sqrt{\\sum_{i=1}^{n}(y_i - \\bar{y})^2}}" },
  { label: "Bayes", source: "P(A \\mid B) = \\frac{P(B \\mid A)\\,P(A)}{P(B)}" },
  { label: "Fourier", source: "\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\, e^{-2\\pi i x \\xi}\\,dx" },
  { label: "Heart Rate", source: "\\text{HR} = \\frac{60}{\\overline{\\text{RR}}}\\ \\text{bpm}" },
  { label: "Euler", source: "e^{i\\pi} + 1 = 0" }
];

const SYMBOL_GROUPS = [
  {
    label: "Greek",
    symbols: [
      ["α", "\\alpha"], ["β", "\\beta"], ["γ", "\\gamma"], ["δ", "\\delta"], ["ε", "\\epsilon"], ["θ", "\\theta"],
      ["λ", "\\lambda"], ["μ", "\\mu"], ["π", "\\pi"], ["ρ", "\\rho"], ["σ", "\\sigma"], ["τ", "\\tau"],
      ["φ", "\\phi"], ["χ", "\\chi"], ["ψ", "\\psi"], ["ω", "\\omega"], ["Γ", "\\Gamma"], ["Δ", "\\Delta"],
      ["Θ", "\\Theta"], ["Λ", "\\Lambda"], ["Π", "\\Pi"], ["Σ", "\\Sigma"], ["Φ", "\\Phi"], ["Ω", "\\Omega"]
    ]
  },
  {
    label: "Operators",
    symbols: [
      ["×", "\\times"], ["÷", "\\div"], ["±", "\\pm"], ["∓", "\\mp"], ["·", "\\cdot"], ["∘", "\\circ"],
      ["∑", "\\sum"], ["∏", "\\prod"], ["∫", "\\int"], ["∬", "\\iint"], ["∮", "\\oint"], ["∂", "\\partial"],
      ["∇", "\\nabla"], ["√", "\\sqrt{}"], ["∞", "\\infty"], ["′", "'"], ["…", "\\ldots"], ["⋯", "\\cdots"]
    ]
  },
  {
    label: "Relations",
    symbols: [
      ["≤", "\\leq"], ["≥", "\\geq"], ["≠", "\\neq"], ["≈", "\\approx"], ["≡", "\\equiv"], ["∼", "\\sim"],
      ["≅", "\\cong"], ["∝", "\\propto"], ["≪", "\\ll"], ["≫", "\\gg"], ["∈", "\\in"], ["∉", "\\notin"],
      ["⊂", "\\subset"], ["⊆", "\\subseteq"], ["⊃", "\\supset"], ["⊥", "\\perp"], ["∥", "\\parallel"], ["∣", "\\mid"]
    ]
  },
  {
    label: "Arrows",
    symbols: [
      ["→", "\\rightarrow"], ["←", "\\leftarrow"], ["↔", "\\leftrightarrow"], ["⇒", "\\Rightarrow"], ["⇐", "\\Leftarrow"], ["⇔", "\\Leftrightarrow"],
      ["↦", "\\mapsto"], ["↑", "\\uparrow"], ["↓", "\\downarrow"], ["⟶", "\\longrightarrow"], ["⟹", "\\implies"], ["⇌", "\\rightleftharpoons"]
    ]
  },
  {
    label: "Sets And Logic",
    symbols: [
      ["ℝ", "\\mathbb{R}"], ["ℕ", "\\mathbb{N}"], ["ℤ", "\\mathbb{Z}"], ["ℚ", "\\mathbb{Q}"], ["ℂ", "\\mathbb{C}"], ["∅", "\\emptyset"],
      ["∪", "\\cup"], ["∩", "\\cap"], ["∖", "\\setminus"], ["∀", "\\forall"], ["∃", "\\exists"], ["¬", "\\neg"],
      ["∧", "\\land"], ["∨", "\\lor"], ["⊕", "\\oplus"], ["⊗", "\\otimes"], ["∴", "\\therefore"], ["∵", "\\because"]
    ]
  }
];

const DEFAULT_SOURCE = "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n\n\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i \\qquad s = \\sqrt{\\frac{1}{n-1}\\sum_{i=1}^{n}(x_i - \\bar{x})^2}\n\n\\RR^n \\ni \\vec{v} = \\begin{bmatrix} v_1 \\\\ \\vdots \\\\ v_n \\end{bmatrix}";

const DEFAULT_MACROS = "\\RR: \\mathbb{R}\n\\E: \\mathbb{E}";

const parseMacros = (text) => {
  const macros = {};
  let invalid = 0;
  text.split("\n").forEach((line) => {
    if (!line.trim()) return;
    const match = line.match(/^\s*(\\[A-Za-z]+)\s*[:=]\s*(.+?)\s*$/);
    if (match) macros[match[1]] = match[2];
    else invalid += 1;
  });
  return { macros, invalid };
};

const splitEquations = (source) => source.split(/\n\s*\n/).map((equation) => equation.trim()).filter(Boolean);

const renderEquation = (source, displayMode, macros) => {
  const options = { displayMode, macros: { ...macros }, strict: "ignore", trust: false, output: "htmlAndMathml" };
  try {
    return { html: katex.renderToString(source, { ...options, throwOnError: true }), error: "" };
  } catch (error) {
    let fallback = "";
    try {
      fallback = katex.renderToString(source, { ...options, throwOnError: false });
    } catch {
      fallback = "";
    }
    return { html: fallback, error: String(error.message || error).replace(/^KaTeX parse error:\s*/, "") };
  }
};

const renderMathMl = (source, displayMode, macros) => {
  try {
    const markup = katex.renderToString(source, { displayMode, macros: { ...macros }, strict: "ignore", throwOnError: false, output: "mathml" });
    const match = markup.match(/<math[\s\S]*<\/math>/);
    return match ? match[0] : markup;
  } catch {
    return "";
  }
};

const buildStandaloneHtml = (bodyHtml) => {
  const version = katex.version || "0.16.9";
  return [
    "<!DOCTYPE html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<title>Equations</title>",
    `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${version}/dist/katex.min.css" />`,
    "<style>body{font-family:sans-serif;padding:32px;}.equation{margin:24px 0;}</style>",
    "</head>",
    "<body>",
    bodyHtml,
    "</body>",
    "</html>"
  ].join("\n");
};

const copyText = (text) => navigator.clipboard.writeText(text);

const downloadTextFile = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const Latex = () => {
  const navigate = useNavigate();
  const { token, loading } = useAuth();

  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [macroText, setMacroText] = useState(DEFAULT_MACROS);
  const [displayMode, setDisplayMode] = useState(true);
  const [fontScale, setFontScale] = useState(1.4);
  const [lightPreview, setLightPreview] = useState(false);
  const [symbolGroup, setSymbolGroup] = useState(SYMBOL_GROUPS[0].label);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!loading && !token) navigate("/login");
  }, [token, loading, navigate]);

  const { macros, invalid: invalidMacros } = useMemo(() => parseMacros(macroText), [macroText]);
  const equations = useMemo(() => splitEquations(source), [source]);
  const rendered = useMemo(
    () => equations.map((equation) => ({ source: equation, ...renderEquation(equation, displayMode, macros) })),
    [equations, displayMode, macros]
  );
  const errorCount = rendered.filter((item) => item.error).length;
  const macroCount = Object.keys(macros).length;
  const activeGroup = SYMBOL_GROUPS.find((group) => group.label === symbolGroup);

  const insertAtCursor = (snippet) => {
    const element = textareaRef.current;
    if (!element) {
      setSource((previous) => previous + snippet);
      return;
    }
    const start = element.selectionStart ?? source.length;
    const end = element.selectionEnd ?? source.length;
    const next = source.slice(0, start) + snippet + source.slice(end);
    setSource(next);
    requestAnimationFrame(() => {
      element.focus();
      const caret = start + snippet.length;
      element.setSelectionRange(caret, caret);
    });
  };

  const markdownExport = equations.map((equation) => (displayMode ? `$$\n${equation}\n$$` : `$${equation}$`)).join("\n\n");
  const mathMlExport = equations.map((equation) => renderMathMl(equation, displayMode, macros)).join("\n\n");
  const htmlExport = rendered.map((item) => `<div class="equation">${item.html}</div>`).join("\n");

  return (
    <div className="toolkitLatexLabApp">
      <Nav activePage="latex" />

      {loading ? (
        <div className="toolkitLatexLabCellHeaderContainer" style={{ justifyContent: "center" }}>
          <div className="loading-wrapper">
            <div className="loading-circle" />
            <label className="loading-title">
              Loading
            </label>
          </div>
        </div>
      ) : (
        <>
          <div className="toolkitLatexLabToolBar">
            <div className="toolkitLatexLabTitle">
              <FontAwesomeIcon icon={faSuperscript} />
              <span>LaTeX</span>
            </div>

            <div className="toolkitLatexLabStatusGroup">
              <span className={`toolkitLatexLabStatusItem ${errorCount ? "toolkitLatexLabStatusError" : equations.length ? "toolkitLatexLabStatusAccent" : ""}`}>
                <span>{errorCount ? `${errorCount} ${errorCount === 1 ? "Error" : "Errors"}` : equations.length ? "Valid" : "Empty"}</span>
              </span>
              <span className="toolkitLatexLabStatusItem">
                <span>{displayMode ? "Block" : "Inline"}</span>
              </span>
              <span className="toolkitLatexLabStatusItem">
                <span>{equations.length} {equations.length === 1 ? "Equation" : "Equations"}</span>
              </span>
              <span className="toolkitLatexLabStatusItem">
                <span>{macroCount} {macroCount === 1 ? "Macro" : "Macros"}</span>
              </span>
            </div>
          </div>

          <div className="toolkitLatexLabShell">
            <aside className="toolkitLatexLabSidebar">
              <section className="toolkitLatexLabSection">
                <div className="toolkitLatexLabSectionTitle">
                  <FontAwesomeIcon icon={faSliders} />
                  Display
                </div>

                <div className="toolkitLatexLabRow">
                  <label className="toolkitLatexLabLabel">Mode</label>
                  <div className="toolkitLatexLabPresets">
                    <button type="button" className={`toolkitLatexLabPresetBtn${displayMode ? " active" : ""}`} onClick={() => setDisplayMode(true)}>
                      Block
                    </button>
                    <button type="button" className={`toolkitLatexLabPresetBtn${!displayMode ? " active" : ""}`} onClick={() => setDisplayMode(false)}>
                      Inline
                    </button>
                  </div>
                </div>

                <div className="toolkitLatexLabRow">
                  <div className="toolkitLatexLabRowHeader">
                    <label className="toolkitLatexLabLabel">Preview Size</label>
                    <span className="toolkitLatexLabValue">{fontScale.toFixed(1)}×</span>
                  </div>
                  <input type="range" min="0.8" max="3" step="0.1" value={fontScale} onChange={(e) => setFontScale(Number(e.target.value))} />
                </div>

                <div className="toolkitLatexLabRow">
                  <label className="toolkitLatexLabLabel">Preview Background</label>
                  <div className="toolkitLatexLabPresets">
                    <button type="button" className={`toolkitLatexLabPresetBtn${!lightPreview ? " active" : ""}`} onClick={() => setLightPreview(false)}>
                      Dark
                    </button>
                    <button type="button" className={`toolkitLatexLabPresetBtn${lightPreview ? " active" : ""}`} onClick={() => setLightPreview(true)}>
                      Light
                    </button>
                  </div>
                </div>
              </section>

              <section className="toolkitLatexLabSection">
                <div className="toolkitLatexLabSectionTitle">
                  <FontAwesomeIcon icon={faShapes} />
                  Templates
                </div>

                <div className="toolkitLatexLabPresets">
                  {TEMPLATES.map((template) => (
                    <button
                      key={template.label}
                      type="button"
                      className="toolkitLatexLabPresetBtn"
                      onClick={() => insertAtCursor(template.snippet)}
                      title={template.snippet}
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="toolkitLatexLabSection">
                <div className="toolkitLatexLabSectionTitle">
                  <FontAwesomeIcon icon={faKeyboard} />
                  Symbols
                </div>

                <div className="toolkitLatexLabRow">
                  <label className="toolkitLatexLabLabel">Category</label>
                  <Dropdown
                    value={symbolGroup}
                    onChange={(option) => setSymbolGroup(option)}
                    options={SYMBOL_GROUPS.map((group) => group.label)}
                    placeholder="Category"
                  />
                </div>

                <div className="toolkitLatexLabSymbolGrid">
                  {activeGroup.symbols.map(([glyph, command]) => (
                    <button
                      key={command}
                      type="button"
                      className="toolkitLatexLabSymbolBtn"
                      onClick={() => insertAtCursor(`${command} `)}
                      title={command}
                    >
                      {glyph}
                    </button>
                  ))}
                </div>
              </section>

              <section className="toolkitLatexLabSection">
                <div className="toolkitLatexLabSectionTitle">
                  <FontAwesomeIcon icon={faBookOpen} />
                  Examples
                </div>

                <div className="toolkitLatexLabPresets">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example.label}
                      type="button"
                      className="toolkitLatexLabPresetBtn"
                      onClick={() => setSource(example.source)}
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="toolkitLatexLabSection">
                <div className="toolkitLatexLabSectionTitle">
                  <FontAwesomeIcon icon={faCode} />
                  Macros
                </div>

                <div className="toolkitLatexLabRow">
                  <div className="toolkitLatexLabRowHeader">
                    <label className="toolkitLatexLabLabel">One Per Line</label>
                    <span className="toolkitLatexLabValue">{macroCount}</span>
                  </div>
                  <textarea
                    className="toolkitLatexLabTextArea toolkitLatexLabTextAreaSmall toolkitLatexLabMono"
                    value={macroText}
                    onChange={(e) => setMacroText(e.target.value)}
                    placeholder="Define a macro such as \RR: \mathbb{R}."
                    spellCheck={false}
                  />
                </div>

                {invalidMacros > 0 && (
                  <div className="toolkitLatexLabWarningText">
                    <FontAwesomeIcon icon={faTriangleExclamation} />
                    <span>{invalidMacros} {invalidMacros === 1 ? "line was" : "lines were"} skipped. Use the form \name: expansion.</span>
                  </div>
                )}
              </section>
            </aside>

            <main className="toolkitLatexLabMain">
              <div className="toolkitLatexLabMainGrid">
                <section className="toolkitLatexLabCard">
                  <div className="toolkitLatexLabCardTitle">
                    <span>Source</span>
                    <div className="toolkitLatexLabCardActions">
                      <span className="toolkitLatexLabCardMeta">{source.length} Characters</span>
                      <button type="button" className="toolkitLatexLabBtn toolkitLatexLabSubtle toolkitLatexLabCardAction" onClick={() => setSource("")}>
                        <FontAwesomeIcon icon={faEraser} /> Clear
                      </button>
                    </div>
                  </div>
                  <textarea
                    ref={textareaRef}
                    className="toolkitLatexLabTextArea toolkitLatexLabMono toolkitLatexLabSourceArea"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="Type LaTeX math here. Separate equations with a blank line."
                    spellCheck={false}
                  />
                </section>

                <section className="toolkitLatexLabCard">
                  <div className="toolkitLatexLabCardTitle">
                    <span>Preview</span>
                  </div>
                  {!equations.length ? (
                    <div className="toolkitLatexLabEmpty">
                      <FontAwesomeIcon icon={faSuperscript} />
                      <p>Type an equation to see it rendered.</p>
                    </div>
                  ) : (
                    <div className={`toolkitLatexLabPreview${lightPreview ? " toolkitLatexLabPreviewLight" : ""}`} style={{ fontSize: `${fontScale}em` }}>
                      {rendered.map((item, index) => (
                        <div key={index} className={`toolkitLatexLabEquation${item.error ? " toolkitLatexLabEquationError" : ""}`}>
                          <div dangerouslySetInnerHTML={{ __html: item.html }} />
                          {item.error && (
                            <div className="toolkitLatexLabEquationMessage">
                              <FontAwesomeIcon icon={faTriangleExclamation} />
                              <span>{item.error}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="toolkitLatexLabCard toolkitLatexLabCardWide">
                  <div className="toolkitLatexLabCardTitle">
                    <span>Export</span>
                    <div className="toolkitLatexLabCardActions">
                      <button
                        type="button"
                        className="toolkitLatexLabBtn toolkitLatexLabCardAction"
                        onClick={() => downloadTextFile(buildStandaloneHtml(htmlExport), "equations.html", "text/html")}
                        disabled={!equations.length}
                      >
                        <FontAwesomeIcon icon={faDownload} /> Download HTML
                      </button>
                    </div>
                  </div>
                  <div className="toolkitLatexLabExportGrid">
                    {[
                      ["LaTeX", equations.join("\n\n")],
                      ["Markdown", markdownExport],
                      ["MathML", mathMlExport],
                      ["HTML", htmlExport]
                    ].map(([label, content]) => (
                      <div key={label} className="toolkitLatexLabExportBlock">
                        <div className="toolkitLatexLabExportHeader">
                          <span className="toolkitLatexLabExportTitle">{label}</span>
                          <div className="toolkitLatexLabExportActions">
                            <button type="button" className="toolkitLatexLabBtn" onClick={() => copyText(content)} disabled={!content}>
                              <FontAwesomeIcon icon={faCopy} /> Copy
                            </button>
                          </div>
                        </div>
                        <pre className="toolkitLatexLabCode">{content || " "}</pre>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </main>
          </div>
        </>
      )}
    </div>
  );
};

export default Latex;