import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch, faCircleNotch, faTriangleExclamation, faArrowUpRightFromSquare, faSpellCheck,
  faBookOpen, faLayerGroup
} from "@fortawesome/free-solid-svg-icons";
import Nav from "../../../../helpers/Nav.jsx";
import useAuth from "../../../../UseAuth.jsx";
import "../../../../styles/mainStyles//Toolkit/Text/Thesaurus/Thesaurus.css";
import "../../../../styles/helperStyles/LoadingSpinner.css";

const MW_THES_BASE = "https://www.dictionaryapi.com/api/v3/references/thesaurus/json";

const getMWThesKey = () => {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      return (
        import.meta.env.VITE_REACT_APP_MW_THESAURUS_KEY ||
        import.meta.env.VITE_MW_THESAURUS_KEY ||
        import.meta.env.VITE_REACT_APP_MW_THES_KEY ||
        ""
      );
    }
  } catch {}
  try {
    if (typeof process !== "undefined" && process.env) {
      return (
        process.env.REACT_APP_MW_THESAURUS_KEY ||
        process.env.MW_THESAURUS_KEY ||
        process.env.REACT_APP_MW_THES_KEY ||
        ""
      );
    }
  } catch {}
  return "";
};

const toArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);

const uniqTrimmed = (arr) => [...new Set(toArray(arr).map((s) => String(s).trim()).filter(Boolean))];

const normalizeThesEntry = (d, fallbackQuery) => {
  const headword =
    (d?.hwi?.hw && String(d.hwi.hw).replace(/\*/g, "·")) ||
    d?.meta?.id ||
    fallbackQuery;

  const fl = d?.fl || "";

  const syns = [];
  const ants = [];

  const defs = Array.isArray(d?.def) ? d.def : [];
  defs.forEach((def) => {
    const sseq = def?.sseq || [];
    sseq.forEach((grp) => {
      grp.forEach((item) => {
        const sense = item?.[1];
        if (!sense) return;
        const synList = sense.syn_list || [];
        synList.forEach((bucket) => {
          const words = bucket.map((w) => w?.wd).filter(Boolean);
          if (words.length) syns.push(words);
        });
        const antList = sense.ant_list || [];
        antList.forEach((bucket) => {
          const words = bucket.map((w) => w?.wd).filter(Boolean);
          if (words.length) ants.push(words);
        });
      });
    });
  });

  const flatSyns = uniqTrimmed(syns.flat());
  const flatAnts = uniqTrimmed(ants.flat());

  const offsiteId = (d?.meta?.id || "").replace(/:.+$/, "");
  const offsiteUrl = offsiteId
    ? `https://www.merriam-webster.com/thesaurus/${encodeURIComponent(offsiteId)}`
    : null;

  return {
    id: d?.meta?.uuid || `${headword}-${fl}`,
    headword,
    fl,
    synBuckets: syns.slice(0, 3),
    syns: flatSyns.slice(0, 24),
    ants: flatAnts.slice(0, 16),
    offsiteUrl
  };
};

const Thesaurus = () => {
  const navigate = useNavigate();
  const { token, loading } = useAuth();

  const apiKey = getMWThesKey();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle");
  const [entries, setEntries] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchThesaurus = useCallback(async (termRaw) => {
    const term = (termRaw || "").trim();
    if (!term) return;

    if (!apiKey) {
      setStatus("error");
      setErrorMsg("The Merriam-Webster Thesaurus key is missing. Set VITE_REACT_APP_MW_THESAURUS_KEY in .env.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    setEntries([]);
    setSuggestions([]);

    try {
      const url = `${MW_THES_BASE}/${encodeURIComponent(term)}?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`The request failed with status ${res.status}.`);
      const data = await res.json();

      if (Array.isArray(data) && data.every((d) => typeof d === "string")) {
        setSuggestions(data.slice(0, 10));
        setEntries([]);
        setStatus("done");
        return;
      }

      const normalized = (Array.isArray(data) ? data : [])
        .filter((d) => d && d.meta)
        .map((d) => normalizeThesEntry(d, term));

      setEntries(normalized);
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setErrorMsg(error?.message || "Something went wrong.");
    }
  }, [apiKey]);

  const onSuggestion = (s) => {
    setQuery(s);
    fetchThesaurus(s);
  };

  const statusLabel = status === "loading" ? "Searching" : status === "error" ? "Error" : status === "done" ? "Results" : "Ready";

  useEffect(() => {
    if (!loading && !token) navigate("/login");
  }, [token, loading, navigate]);

  return (
    <div className="toolkitThesaurusApp">
      <Nav activePage="thesaurus" />

      {loading ? (
        <div className="toolkitThesaurusCellHeaderContainer" style={{ justifyContent: "center" }}>
          <div className="loading-wrapper">
            <div className="loading-circle" />
            <label className="loading-title">
              Loading
            </label>
          </div>
        </div>
      ) : (
        <>
          <div className="toolkitThesaurusToolBar">
            <div className="toolkitThesaurusTitle">
              <FontAwesomeIcon icon={faBookOpen} />
              <span>Thesaurus</span>
            </div>

            <div className="toolkitThesaurusStatusGroup">
              <span className={`toolkitThesaurusStatusItem${status === "error" ? " toolkitThesaurusStatusError" : ""}`}>
                <span>{statusLabel}</span>
              </span>
              <span className="toolkitThesaurusStatusItem">
                <span>{entries.length} {entries.length === 1 ? "Entry" : "Entries"}</span>
              </span>
              {suggestions.length > 0 && (
                <span className="toolkitThesaurusStatusItem">
                  <span>{suggestions.length} {suggestions.length === 1 ? "Suggestion" : "Suggestions"}</span>
                </span>
              )}
              <span className={`toolkitThesaurusStatusItem ${apiKey ? "toolkitThesaurusStatusAccent" : "toolkitThesaurusStatusWarning"}`}>
                <span>{apiKey ? "API Key Set" : "API Key Missing"}</span>
              </span>
            </div>
          </div>

          <div className="toolkitThesaurusShell">
            <aside className="toolkitThesaurusSidebar">
              <section className="toolkitThesaurusSection">
                <div className="toolkitThesaurusSectionTitle">
                  <FontAwesomeIcon icon={faSearch} />
                  Search
                </div>

                <div className="toolkitThesaurusRow">
                  <label className="toolkitThesaurusLabel">Word</label>
                  <input
                    className="toolkitThesaurusInput"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        fetchThesaurus(query);
                      }
                    }}
                    placeholder="Search for synonyms of a word."
                    maxLength={64}
                    inputMode="search"
                    autoCorrect="off"
                  />
                </div>

                <div className="toolkitThesaurusActions">
                  <button
                    className="toolkitThesaurusBtn"
                    disabled={status === "loading"}
                    onClick={() => fetchThesaurus(query)}
                    type="button"
                  >
                    <FontAwesomeIcon icon={status === "loading" ? faCircleNotch : faSearch} spin={status === "loading"} />
                    {status === "loading" ? "Searching" : "Search"}
                  </button>
                </div>
              </section>

              {status === "done" && suggestions.length > 0 && (
                <section className="toolkitThesaurusSection">
                  <div className="toolkitThesaurusSectionTitle">
                    <FontAwesomeIcon icon={faSpellCheck} />
                    Did You Mean
                  </div>

                  <div className="toolkitThesaurusPresets">
                    {suggestions.map((s) => (
                      <button key={s} className="toolkitThesaurusPresetBtn" onClick={() => onSuggestion(s)} type="button">
                        {s}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="toolkitThesaurusSection">
                <div className="toolkitThesaurusSectionTitle">
                  <FontAwesomeIcon icon={faLayerGroup} />
                  Results
                </div>

                <div className="toolkitThesaurusStats">
                  <div className="toolkitThesaurusStat">
                    <span className="toolkitThesaurusStatLabel">Entries</span>
                    <span className="toolkitThesaurusStatValue">{entries.length}</span>
                  </div>
                  <div className="toolkitThesaurusStat">
                    <span className="toolkitThesaurusStatLabel">Synonyms</span>
                    <span className="toolkitThesaurusStatValue">{entries.reduce((total, entry) => total + entry.syns.length, 0)}</span>
                  </div>
                </div>
              </section>

              {!apiKey && (
                <section className="toolkitThesaurusSection">
                  <div className="toolkitThesaurusSectionTitle">
                    <FontAwesomeIcon icon={faTriangleExclamation} />
                    Setup
                  </div>

                  <div className="toolkitThesaurusBanner">
                    <span>Add <code>VITE_REACT_APP_MW_THESAURUS_KEY</code> to <code>.env</code>.</span>
                  </div>
                </section>
              )}
            </aside>

            <main className="toolkitThesaurusMain">
              <div className="toolkitThesaurusMainGrid">
                {entries.length === 0 ? (
                  <section className="toolkitThesaurusCard toolkitThesaurusCardWide">
                    <div className="toolkitThesaurusCardTitle">Synonyms</div>
                    {status === "error" ? (
                      <div className="toolkitThesaurusEmpty toolkitThesaurusError">
                        <FontAwesomeIcon icon={faTriangleExclamation} />
                        <p>{errorMsg || "The results could not be fetched."}</p>
                      </div>
                    ) : status === "loading" ? (
                      <div className="toolkitThesaurusEmpty">
                        <FontAwesomeIcon icon={faCircleNotch} spin />
                        <p>Searching</p>
                      </div>
                    ) : suggestions.length > 0 ? (
                      <div className="toolkitThesaurusEmpty">
                        <FontAwesomeIcon icon={faSpellCheck} />
                        <p>No exact match was found. Choose a suggestion to continue.</p>
                      </div>
                    ) : (
                      <div className="toolkitThesaurusEmpty">
                        <FontAwesomeIcon icon={faBookOpen} />
                        <p>Type a word and press Enter to explore synonyms.</p>
                      </div>
                    )}
                  </section>
                ) : (
                  entries.map((e) => (
                    <section key={e.id} className="toolkitThesaurusCard">
                      <div className="toolkitThesaurusCardTitle">
                        <span className="toolkitThesaurusWord">{e.headword}</span>
                        {e.fl && <span className="toolkitThesaurusPos">{e.fl}</span>}
                      </div>

                      <div className="toolkitThesaurusSynonyms">
                        <div className="toolkitThesaurusSectionLabel">Synonyms</div>
                        {e.synBuckets && e.synBuckets.length > 0 ? (
                          e.synBuckets.map((bucket, idx) => (
                            <div key={idx} className="toolkitThesaurusChipRow">
                              {bucket.slice(0, 10).map((w, i) => (
                                <span key={i} className="toolkitThesaurusSynChip">
                                  {w}
                                </span>
                              ))}
                            </div>
                          ))
                        ) : e.syns.length > 0 ? (
                          <div className="toolkitThesaurusChipRow">
                            {e.syns.map((w, i) => (
                              <span key={i} className="toolkitThesaurusSynChip">
                                {w}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="toolkitThesaurusNoResults">No synonyms were found.</div>
                        )}

                        {e.ants && e.ants.length > 0 && (
                          <div className="toolkitThesaurusAntonyms">
                            <div className="toolkitThesaurusSectionLabel">Antonyms</div>
                            <div className="toolkitThesaurusChipRow">
                              {e.ants.map((w, i) => (
                                <span key={i} className="toolkitThesaurusAntChip">
                                  {w}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {e.offsiteUrl && (
                        <a
                          className="toolkitThesaurusBtn toolkitThesaurusSubtle toolkitThesaurusLink"
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

export default Thesaurus;