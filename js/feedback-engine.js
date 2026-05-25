/* feedback-engine.js
 * Heuristic argument + grammar analyser. Designed to be replaced by an LLM
 * call in production: see ArguMentorEngine.analyseAsync() — currently
 * synchronous, but already returns a Promise so the editor code does not
 * need to change when a real model is wired in. */

(function (global) {
  'use strict';

  // ---------- Toulmin component cues ----------
  // Each component has lexical/syntactic cues drawn from argument-writing
  // research (Toulmin 1958, applied per Turós et al. 2024).
  const CUES = {
    claim: [
      /\b(I (?:argue|believe|contend|maintain|claim|hold)\b)/i,
      /\b(my (?:position|view|stance|argument|thesis) is)/i,
      /\b(should (?:be|not be) (?:banned|allowed|adopted|required|permitted))/i,
      /\bthis (?:essay|paper) (?:argues|contends|will argue|will show)/i,
      /\b(it is (?:clear|evident|imperative) that)/i
    ],
    data: [
      /\b(?:according to|based on)\s+[A-Z]/,
      /\b\d{1,3}(?:\.\d+)?\s*(?:%|percent)\b/,
      /\b(?:study|studies|research|survey|report|data|statistics) (?:by|from|show|shows|found|indicate)/i,
      /\b(?:in\s+\d{4}|\([A-Z][a-z]+(?:\s+(?:&|et al\.?))?,?\s*\d{4}\))/,
      /\b(?:for example|for instance|evidence shows|recent data)/i
    ],
    warrant: [
      /\b(?:because|since|as a result|therefore|thus|hence|consequently|this (?:means|suggests|implies|shows) that)\b/i,
      /\b(?:this (?:demonstrates|illustrates|reveals))/i,
      /\b(?:the underlying (?:principle|reason|logic))\b/i
    ],
    backing: [
      /\b(?:research (?:consistently|repeatedly) (?:shows|finds))/i,
      /\b(?:replicated|corroborat(?:ed|es)|further support(?:ed)? by)/i,
      /\b(?:multiple studies|a range of studies|the literature)/i,
      /\b(?:has been confirmed|is well-established)/i
    ],
    qualifier: [
      /\b(?:in most cases|generally|usually|often|sometimes|in many|to some extent)\b/i,
      /\b(?:may|might|could|likely|probably|presumably|tends to)\b/i,
      /\b(?:although|under certain conditions|provided that|assuming that)/i
    ],
    rebuttal: [
      /\b(?:however|nevertheless|on the other hand|critics (?:argue|claim|contend)|opponents (?:argue|say))/i,
      /\b(?:some (?:may|might|would) (?:argue|say|claim|object))/i,
      /\b(?:although|despite|even though|while it is true)/i,
      /\b(?:counter[- ]?argument|rebuttal)/i
    ]
  };

  // ---------- Grammar / style heuristic rules ----------
  // Cover the most common HK ESL Grade-11 errors. Each rule produces a
  // friendly, learner-centred message rather than a cryptic warning.
  const GRAMMAR_RULES = [
    // Subject–verb agreement (third-person singular)
    { re: /\b(he|she|it)\s+(have|do|go|say|make|come|take|see|know|get|give|find|think|tell|become|leave|feel|bring|begin|keep|hold|write|stand|hear|let)\b/gi,
      type: 'grammar', label: 'Subject–verb agreement',
      msg: (m) => `"${m[0]}" — third-person singular needs an -s/-es ending (e.g., "${m[1]} ${conjugate(m[2])}").` },
    // Common a/an misuse before vowel sounds (skip 'u-' words that take 'a': university, user, unique, useful, ubiquitous)
    { re: /\ba\s+(?!(?:university|universal|user|unique|useful|ubiquitous|union|united|one)\b)([aeiou]\w*)/gi, type: 'grammar', label: 'Article: a → an',
      msg: (m) => `"a ${m[1]}" should be "an ${m[1]}" — use "an" before vowel sounds.` },
    // Double negatives
    { re: /\b(don'?t|doesn'?t|didn'?t|won'?t|cannot|can'?t)\s+\w+\s+(no|nothing|none|nobody|nowhere|never)\b/gi,
      type: 'grammar', label: 'Double negative',
      msg: (m) => `Avoid double negatives: "${m[0]}" — try rewording.` },
    // It's / its confusion
    { re: /\bits\s+(a|an|the|been|going|important|clear|true|possible)\b/gi, type: 'grammar', label: "Its vs it's",
      msg: (m) => `"its ${m[1]}" — use "it's" (it is) here.` },
    // Their / there / they're
    { re: /\bthere\s+(opinion|argument|view|claim|evidence|essay|writing)\b/gi, type: 'grammar', label: 'There vs their',
      msg: (m) => `"there ${m[1]}" — likely "their ${m[1]}" (possessive).` },
    // Passive over-use marker (informational, not an error)
    { re: /\b(?:was|were|is|are|been|being)\s+\w+ed\s+by\b/g, type: 'style', label: 'Passive voice',
      msg: () => 'Passive voice spotted. Check whether an active subject would be stronger.' },
    // Wordy phrases
    { re: /\bin order to\b/gi, type: 'style', label: 'Wordiness',
      msg: () => '"in order to" → "to" is usually clearer.' },
    { re: /\bdue to the fact that\b/gi, type: 'style', label: 'Wordiness',
      msg: () => '"due to the fact that" → "because".' },
    { re: /\bat this point in time\b/gi, type: 'style', label: 'Wordiness',
      msg: () => '"at this point in time" → "now".' },
    { re: /\ba lot of\b/gi, type: 'style', label: 'Register',
      msg: () => '"a lot of" is informal. In academic writing, prefer "many", "several", or "a substantial number of".' },
    // Sentence starts with conjunction (informational)
    { re: /(^|[.!?]\s+)(But|And|Because|So)\b/g, type: 'style', label: 'Sentence opener',
      msg: (m) => `Starting a sentence with "${m[2]}" is informal in academic prose. Consider "However" / "Furthermore" / "Therefore".` },
    // Repeated word ("the the")
    { re: /\b(\w+)\s+\1\b/gi, type: 'grammar', label: 'Repeated word',
      msg: (m) => `Word repeated: "${m[0]}".` },
    // Missing comma after introductory adverbial
    { re: /\b(However|Therefore|Furthermore|Moreover|Nevertheless|Consequently|In contrast|For example|For instance)\s+(?!,)/g,
      type: 'grammar', label: 'Missing comma',
      msg: (m) => `Add a comma after the introductory word: "${m[1]}, ...".` },
    // Spelling — high-frequency confusables for ESL students
    { re: /\b(recieve|recieved)\b/gi, type: 'grammar', label: 'Spelling',
      msg: () => '"recieve" → "receive" (i before e, except after c).' },
    { re: /\b(seperate|seperated)\b/gi, type: 'grammar', label: 'Spelling',
      msg: () => '"seperate" → "separate".' },
    { re: /\b(definately)\b/gi, type: 'grammar', label: 'Spelling',
      msg: () => '"definately" → "definitely".' },
    { re: /\b(occured|occuring)\b/gi, type: 'grammar', label: 'Spelling',
      msg: () => '"occured" → "occurred" (double r).' },
    { re: /\b(wich)\b/gi, type: 'grammar', label: 'Spelling',
      msg: () => '"wich" → "which".' }
  ];

  function conjugate(verb) {
    const v = verb.toLowerCase();
    const map = { have: 'has', do: 'does', go: 'goes', say: 'says', make: 'makes',
      come: 'comes', take: 'takes', see: 'sees', know: 'knows', get: 'gets',
      give: 'gives', find: 'finds', think: 'thinks', tell: 'tells',
      become: 'becomes', leave: 'leaves', feel: 'feels', bring: 'brings',
      begin: 'begins', keep: 'keeps', hold: 'holds', write: 'writes',
      stand: 'stands', hear: 'hears', let: 'lets' };
    return map[v] || (v + 's');
  }

  function safeRegex(re, text) {
    re.lastIndex = 0;
    const out = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      out.push({ match: m, index: m.index, length: m[0].length });
      if (!re.global) break;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return out;
  }

  // ---------- Toulmin component detection ----------
  function detectComponents(text) {
    const result = {};
    Object.keys(CUES).forEach(comp => {
      const hits = [];
      CUES[comp].forEach(re => {
        safeRegex(re, text).forEach(h => hits.push({ index: h.index, length: h.length, snippet: h.match[0] }));
      });
      result[comp] = hits;
    });
    return result;
  }

  // ---------- Argument quality scoring ----------
  function scoreArgument(text, components) {
    const wc = wordCount(text);
    const presence = comp => Math.min(1, components[comp].length / (comp === 'claim' || comp === 'data' ? 1 : 1));

    // Six Toulmin sub-scores 0–100. Length-aware so short essays don't get unfair full marks.
    const lengthFactor = Math.min(1, wc / 200);
    const sub = {
      claim:     Math.round(presence('claim')     * 100 * (0.6 + 0.4 * lengthFactor)),
      data:      Math.round(Math.min(1, components.data.length / 2)     * 100 * (0.5 + 0.5 * lengthFactor)),
      warrant:   Math.round(Math.min(1, components.warrant.length / 2)  * 100 * (0.5 + 0.5 * lengthFactor)),
      backing:   Math.round(Math.min(1, components.backing.length / 1)  * 100 * (0.5 + 0.5 * lengthFactor)),
      qualifier: Math.round(Math.min(1, components.qualifier.length / 1)* 100 * (0.6 + 0.4 * lengthFactor)),
      rebuttal:  Math.round(Math.min(1, components.rebuttal.length / 1) * 100 * (0.6 + 0.4 * lengthFactor))
    };

    // Organization heuristic: paragraphs + use of cohesion markers.
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    const cohesion = (text.match(/\b(however|therefore|furthermore|moreover|in contrast|consequently|firstly|secondly|finally)\b/gi) || []).length;
    const organization = Math.min(100, Math.round((Math.min(paragraphs, 5) / 5) * 60 + Math.min(cohesion, 6) / 6 * 40));

    // Language quality: penalise frequent grammar issues; reward varied sentence length.
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const lens = sentences.map(s => s.trim().split(/\s+/).length);
    const meanLen = lens.length ? lens.reduce((a,b)=>a+b,0)/lens.length : 0;
    const variance = lens.length ? lens.reduce((a,b)=>a + (b-meanLen)*(b-meanLen), 0) / lens.length : 0;
    const language = Math.max(20, Math.min(100, Math.round(60 + Math.min(variance, 50)/2)));

    const overall = Math.round(
      0.20 * sub.claim + 0.18 * sub.data + 0.13 * sub.warrant +
      0.09 * sub.backing + 0.08 * sub.qualifier + 0.12 * sub.rebuttal +
      0.10 * organization + 0.10 * language
    );

    return { sub, organization, language, overall };
  }

  // ---------- Grammar / style scan ----------
  function scanGrammar(text) {
    const issues = [];
    GRAMMAR_RULES.forEach(rule => {
      safeRegex(rule.re, text).forEach(({ match, index }) => {
        issues.push({
          type: rule.type,
          label: rule.label,
          message: rule.msg(match),
          quote: match[0],
          index
        });
      });
    });
    // Cap at 30 to keep the panel readable.
    return issues.slice(0, 30);
  }

  // ---------- Argument-level coaching tips ----------
  function generateArgumentTips(components, scores, text) {
    const tips = [];
    if (components.claim.length === 0) {
      tips.push({
        kind: 'argument',
        label: 'Missing thesis claim',
        message: 'Your essay has no clear position statement. Try opening or closing your introduction with: "I argue that…" or "This essay contends that…".'
      });
    }
    if (components.data.length === 0 && wordCount(text) > 80) {
      tips.push({
        kind: 'argument',
        label: 'No evidence detected',
        message: 'Strong arguments need data — facts, statistics, examples, or citations. Add "According to [source]…" or "A 2023 study found…".'
      });
    }
    if (components.warrant.length === 0 && components.data.length > 0) {
      tips.push({
        kind: 'argument',
        label: 'Evidence not connected to claim',
        message: 'You have evidence, but the link to your claim is missing. Add a warrant: "This shows that…" or "These findings suggest that…".'
      });
    }
    if (components.rebuttal.length === 0 && wordCount(text) > 150) {
      tips.push({
        kind: 'argument',
        label: 'No counter-argument addressed',
        message: 'A persuasive essay engages with opposing views. Add a paragraph beginning "Critics may argue…" and respond to it.'
      });
    }
    if (components.qualifier.length === 0 && wordCount(text) > 150) {
      tips.push({
        kind: 'argument',
        label: 'Claim sounds absolute',
        message: 'Adding qualifiers such as "in most cases" or "to a large extent" makes a claim more defensible.'
      });
    }
    if (components.backing.length === 0 && components.data.length > 0) {
      tips.push({
        kind: 'argument',
        label: 'Evidence stands alone',
        message: 'Backing strengthens evidence by showing it is not isolated. Phrase: "This finding has been replicated by…".'
      });
    }
    return tips;
  }

  // ---------- Socratic tutor reply ----------
  // Designed never to write the essay for the student — Vygotsky's "more
  // knowledgeable other" scaffolding the cognitive process (Hayes 2012).
  function tutorReply(userMsg, context) {
    const m = (userMsg || '').toLowerCase();

    if (m.includes('write my essay') || m.includes('write the essay') || m.includes('finish it for me')) {
      return "I won't write the essay for you — that would skip exactly the thinking practice that builds the skill. But I can ask you a question that gets you unstuck: what is the single most important sentence in your argument right now, and would a stranger know your position from it?";
    }
    if (m.match(/toulmin|six component|6 component/)) {
      return "Toulmin's model has six parts:\n• CLAIM — the position you defend\n• DATA — the evidence supporting it\n• WARRANT — the reasoning that links data to claim\n• BACKING — broader support that makes the warrant credible\n• QUALIFIER — how strongly you state the claim ('in most cases', 'often')\n• REBUTTAL — the strongest counter-argument and your response\n\nWhich one would you like to practise first?";
    }
    if (m.match(/thesis|claim|stance|position/)) {
      return "Good — let's sharpen your claim.\n1) State your position in one sentence.\n2) Make sure it is debatable: someone reasonable could disagree.\n3) Make it specific: avoid 'AI is good' — try 'AI writing tools improve learning when paired with explicit teacher guidance.'\n\nWhat is your one-sentence claim right now?";
    }
    if (m.match(/evidence|data|source|cite|statistics/)) {
      return "Evidence in argumentative writing usually comes in four flavours:\n• Statistics ('78% of students…')\n• Studies ('Marzuki et al. (2023) found…')\n• Examples ('The 2023 HK reform showed…')\n• Authority ('The OECD reports…')\n\nWhich type fits your topic? Pick one and tell me what claim it would support.";
    }
    if (m.match(/counter|rebuttal|opposing|other side/)) {
      return "A strong rebuttal does three things:\n1) Name the strongest opposing view fairly (don't strawman it).\n2) Concede whatever is genuinely valid in it.\n3) Show why your position still holds — usually because the opposing view misses something specific.\n\nTell me your claim and I'll help you find the strongest counter to it.";
    }
    if (m.match(/structure|organi[sz]e|paragraph|intro/)) {
      return "A reliable structure for a Grade-11 argumentative essay:\n• Intro: hook → context → CLAIM\n• Body 1: strongest reason + DATA + WARRANT\n• Body 2: second reason + DATA + WARRANT + BACKING\n• Body 3: REBUTTAL — opposing view + your response\n• Conclusion: restate claim with QUALIFIER + 'so what'\n\nWhich paragraph are you working on?";
    }
    if (m.match(/help|stuck|don'?t know|lost/)) {
      return "Let's get unstuck with one question at a time.\nFirst, in one sentence: what are you arguing for or against in this essay?";
    }
    // Default Socratic move: turn the question back, gently.
    if (context && context.draftLength > 50) {
      return "Reading your draft, here's a question to push your thinking: which of your sentences is the one you'd remove last — the one that carries your whole argument? If it isn't obvious, that's the sentence to strengthen first.";
    }
    return "I'm here to help you build the argument yourself, not to draft it for you. To start, can you tell me in one sentence what position you want to defend in this essay?";
  }

  // ---------- Helpers ----------
  function wordCount(text) {
    return (text || '').trim().split(/\s+/).filter(Boolean).length;
  }
  function readingTime(text) {
    return Math.max(1, Math.round(wordCount(text) / 200));
  }

  // ---------- Public API ----------
  const ArguMentorEngine = {
    analyse(text) {
      const components = detectComponents(text);
      const scores = scoreArgument(text, components);
      const grammar = scanGrammar(text);
      const tips = generateArgumentTips(components, scores, text);
      return {
        wordCount: wordCount(text),
        readingTime: readingTime(text),
        components, scores,
        grammarIssues: grammar,
        argumentTips: tips
      };
    },
    analyseAsync(text) {
      // Drop-in seam for a real LLM call later.
      return Promise.resolve(this.analyse(text));
    },
    tutorReply,
    wordCount,
    readingTime
  };

  global.ArguMentorEngine = ArguMentorEngine;
})(window);
