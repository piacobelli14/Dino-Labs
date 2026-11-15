import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch, faCircleNotch, faTriangleExclamation, faArrowUpRightFromSquare, faSpellCheck,
  faBook, faLayerGroup
} from "@fortawesome/free-solid-svg-icons";
import Nav from "../../../../helpers/Nav.jsx";
import useAuth from "../../../../UseAuth.jsx";
import "../../../../styles/mainStyles//Toolkit/Text/Dictionary/Dictionary.css";
import "../../../../styles/helperStyles/LoadingSpinner.css";

const getMWKey = () => {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      return (
        import.meta.env.VITE_REACT_APP_MW_DICTIONARY_KEY ||
        import.meta.env.VITE_REACT_APP_MW_DICT_KEY ||
        import.meta.env.VITE_MW_DICTIONARY_KEY ||
        import.meta.env.VITE_MW_KEY ||
        ""
      );
    }
  } catch {}
  try {
    if (typeof process !== "undefined" && process.env) {
      return (
        process.env.REACT_APP_MW_DICTIONARY_KEY ||
        process.env.REACT_APP_MW_DICT_KEY ||
        process.env.MW_DICTIONARY_KEY ||
        process.env.MW_KEY ||
        ""
      );
    }
  } catch {}
  return "";
};

const MW_API_BASE = "https://www.dictionaryapi.com/api/v3/references/collegiate/json";

const Dictionary = () => {
  const navigate = useNavigate();
  const { token, loading } = useAuth();

  const apiKey = getMWKey();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle");
  const [entries, setEntries] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchDefinitions = useCallback(async (termRaw) => {
    const term = (termRaw || "").trim();
    if (!term) return;

    if (!apiKey) {
      setStatus("error");
      setErrorMsg("The Merriam-Webster API key is missing. Set VITE_REACT_APP_MW_DICTIONARY_KEY in .env.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    setEntries([]);
    setSuggestions([]);

    try {
      const url = `${MW_API_BASE}/${encodeURIComponent(term)}?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`The request failed with status ${res.status}.`);
      const data = await res.json();

      if (Array.isArray(data) && data.every((d) => typeof d === "string")) {
        setSuggestions(data.slice(0, 12));
        setEntries([]);
        setStatus("done");
        return;
      }

      const normalized = (Array.isArray(data) ? data : [])
        .filter((d) => d && d.meta && d.hwi)
        .map((d) => {
          const headword = d?.hwi?.hw ? String(d.hwi.hw).replace(/\*/g, "·") : d?.meta?.id || term;
          const fl = d?.fl || "";
          const shortdef = Array.isArray(d?.shortdef) ? d.shortdef : [];
          const offsiteId = (d?.meta?.id || "").replace(/:.+$/, "");
          const offsiteUrl = offsiteId ? `https://www.merriam-webster.com/dictionary/${encodeURIComponent(offsiteId)}` : null;

          return {
            id: d?.meta?.uuid || `${headword}-${fl}`,
            headword,
            fl,
            defs: shortdef.slice(0, 6),
            offsiteUrl
          };
        });

      setEntries(normalized);
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setErrorMsg(error?.message || "Something went wrong.");
    }
  }, [apiKey]);

  const onSuggestion = (s) => {
    setQuery(s);
    fetchDefinitions(s);
  };

  const statusLabel = status === "loading" ? "Searching" : status === "error" ? "Error" : status === "done" ? "Results" : "Ready";

  useEffect(() => {
    if (!loading && !token) navigate("/login");
  }, [token, loading, navigate]);

  return (
    <div className="toolkitDictionaryApp">
      <Nav activePage="dictionary" />

      {loading ? (
        <div className="toolkitDictionaryCellHeaderContainer" style={{ justifyContent: "center" }}>
          <div className="loading-wrapper">
            <div className="loading-circle" />
            <label className="loading-title">
              Loading
            </label>
          </div>
        </div>
      ) : (
        <>
          <div className="toolkitDictionaryToolBar">
            <div className="toolkitDictionaryTitle">
              <FontAwesomeIcon icon={faBook} />
              <span>Dictionary</span>
            </div>

            <div className="toolkitDictionaryStatusGroup">
              <span className={`toolkitDictionaryStatusItem${status === "error" ? " toolkitDictionaryStatusError" : ""}`}>
                <span>{statusLabel}</span>
              </span>
              <span className="toolkitDictionaryStatusItem">
                <span>{entries.length} {entries.length === 1 ? "Entry" : "Entries"}</span>
              </span>
              {suggestions.length > 0 && (
                <span className="toolkitDictionaryStatusItem">
                  <span>{suggestions.length} {suggestions.length === 1 ? "Suggestion" : "Suggestions"}</span>
                </span>
              )}
              <span className={`toolkitDictionaryStatusItem ${apiKey ? "toolkitDictionaryStatusAccent" : "toolkitDictionaryStatusWarning"}`}>
                <span>{apiKey ? "API Key Set" : "API Key Missing"}</span>
              </span>
            </div>
          </div>

          <div className="toolkitDictionaryShell">
            <aside className="toolkitDictionarySidebar">
              <section className="toolkitDictionarySection">
                <div className="toolkitDictionarySectionTitle">
                  <FontAwesomeIcon icon={faSearch} />
                  Search
                </div>

                <div className="toolkitDictionaryRow">
                  <label className="toolkitDictionaryLabel">Word</label>
                  <input
                    className="toolkitDictionaryInput"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        fetchDefinitions(query);
                      }
                    }}
                    placeholder="Search for a word."
                    maxLength={64}
                    inputMode="search"
                    autoCorrect="off"
                  />
                </div>

                <div className="toolkitDictionaryActions">
                  <button
                    className="toolkitDictionaryBtn"
                    disabled={status === "loading"}
                    onClick={() => fetchDefinitions(query)}
                    type="button"
                  >
                    <FontAwesomeIcon icon={status === "loading" ? faCircleNotch : faSearch} spin={status === "loading"} />
                    {status === "loading" ? "Searching" : "Search"}
                  </button>
                </div>
              </section>

              {status === "done" && suggestions.length > 0 && (
                <section className="toolkitDictionarySection">
                  <div className="toolkitDictionarySectionTitle">
                    <FontAwesomeIcon icon={faSpellCheck} />
                    Did You Mean
                  </div>

                  <div className="toolkitDictionaryPresets">
                    {suggestions.map((s) => (
                      <button key={s} className="toolkitDictionaryPresetBtn" onClick={() => onSuggestion(s)} type="button">
                        {s}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="toolkitDictionarySection">
                <div className="toolkitDictionarySectionTitle">
                  <FontAwesomeIcon icon={faLayerGroup} />
                  Results
                </div>

                <div className="toolkitDictionaryStats">
                  <div className="toolkitDictionaryStat">
                    <span className="toolkitDictionaryStatLabel">Entries</span>
                    <span className="toolkitDictionaryStatValue">{entries.length}</span>
                  </div>
                  <div className="toolkitDictionaryStat">
                    <span className="toolkitDictionaryStatLabel">Definitions</span>
                    <span className="toolkitDictionaryStatValue">{entries.reduce((total, entry) => total + entry.defs.length, 0)}</span>
                  </div>
                </div>
              </section>

              {!apiKey && (
                <section className="toolkitDictionarySection">
                  <div className="toolkitDictionarySectionTitle">
                    <FontAwesomeIcon icon={faTriangleExclamation} />
                    Setup
                  </div>

                  <div className="toolkitDictionaryBanner">
                    <span>Add <code>VITE_REACT_APP_MW_DICTIONARY_KEY</code> to <code>.env</code>.</span>
                  </div>
                </section>
              )}
            </aside>

            <main className="toolkitDictionaryMain">
              <div className="toolkitDictionaryMainGrid">
                {entries.length === 0 ? (
                  <section className="toolkitDictionaryCard toolkitDictionaryCardWide">
                    <div className="toolkitDictionaryCardTitle">Definitions</div>
                    {status === "error" ? (
                      <div className="toolkitDictionaryEmpty toolkitDictionaryError">
                        <FontAwesomeIcon icon={faTriangleExclamation} />
                        <p>{errorMsg || "The results could not be fetched."}</p>
                      </div>
                    ) : status === "loading" ? (
                      <div className="toolkitDictionaryEmpty">
                        <FontAwesomeIcon icon={faCircleNotch} spin />
                        <p>Searching</p>
                      </div>
                    ) : suggestions.length > 0 ? (
                      <div className="toolkitDictionaryEmpty">
                        <FontAwesomeIcon icon={faSpellCheck} />
                        <p>No exact match was found. Choose a suggestion to continue.</p>
                      </div>
                    ) : (
                      <div className="toolkitDictionaryEmpty">
                        <FontAwesomeIcon icon={faBook} />
                        <p>Type a word and press Enter to look it up.</p>
                      </div>
                    )}
                  </section>
                ) : (
                  entries.map((e) => (
                    <section key={e.id} className="toolkitDictionaryCard">
                      <div className="toolkitDictionaryCardTitle">
                        <span className="toolkitDictionaryWord">{e.headword}</span>
                        {e.fl && <span className="toolkitDictionaryPos">{e.fl}</span>}
                      </div>

                      <div className="toolkitDictionaryDefs">
                        {e.defs.length === 0 ? (
                          <div className="toolkitDictionaryNoResults">No definition is available.</div>
                        ) : (
                          e.defs.map((d, idx) => (
                            <div key={idx} className="toolkitDictionaryDef">
                              <span className="toolkitDictionaryNum">{idx + 1}</span>
                              <span className="toolkitDictionaryText">{d}</span>
                            </div>
                          ))
                        )}
                      </div>

                      {e.offsiteUrl && (
                        <a
                          className="toolkitDictionaryBtn toolkitDictionarySubtle toolkitDictionaryLink"
                          href={e.offsiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                          <span>View Full Entry</span>
                        </a>
                      )}
                    </section>
                  ))
                )}
              </div>
            </main>
          </div>
        </>
      )}
    </div>
  );
};

export default Dictionary;