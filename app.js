'use strict';
(() => {
  const study = window.LISTENING_STUDY;
  const dimensions = [
    { id:'speaker_similarity', title:'Speaker Similarity', description:'Does the translated voice match the original speaker(s) in the Source?', low:'1 = Completely different voice', high:'5 = Identical to source speaker(s)' },
    { id:'prosody_similarity', title:'Prosody Similarity', description:"Does each speaker's way of speaking carry over from the Source — intonation, rhythm and pace, emphasis, and emotion or attitude (e.g. a question still sounds like a question, hesitation or excitement is kept)? The language changes, so judge the delivery, not the words. This is not about whose voice it is (Speaker Similarity) or how the speakers hand over (Conversational Naturalness).", low:'1 = Unrelated to the source delivery', high:'5 = Same intonation, rhythm and expressiveness as the source' },
    { id:'conversational_naturalness', title:'Conversational Naturalness', description:'Does the exchange flow like a real conversation? Judge the transitions between speakers (pacing, pauses, no abrupt cuts), not just how natural one speaker sounds alone.', low:'1 = Disjointed, abrupt hand-offs', high:'5 = Flows like a real conversation' },
    { id:'speaker_turn', title:'Speaker Turn', description:'Is the multi-speaker turn-taking structure preserved (who speaks when, no merged/dropped turns)? A binary judgement, not a matter of degree.', low:'0 = Turns are messed up', high:'1 = Turns are preserved', binary:true },
    { id:'translation_quality', title:'Translation Quality', description:'How accurately does the translation convey the meaning of the source? Judge against the source transcript and audio as you perceive it.', low:'1 = Meaning lost / wrong', high:'5 = Meaning fully conveyed' },
    { id:'overall_quality', title:'Overall Quality', description:'Your overall impression of this translation as a whole.', low:'1 = Poor', high:'5 = Excellent' }
  ];
  const $ = id => document.getElementById(id);
  const prefix = `s2st-listening:v1:${study.fingerprint}:`;
  const lastRaterKey = `${prefix}last-rater`;
  const total = study.samples.length * 4 * dimensions.length;
  let state = null;
  let index = 0;
  let storageAvailable = true;
  let downloadURL = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function status(text, error = false) {
    $('save-status').textContent = text;
    $('save-status').classList.toggle('error', error);
  }
  function storageGet(key) {
    try { return localStorage.getItem(key); }
    catch (_) { storageAvailable = false; return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (_) { storageAvailable = false; return false; }
  }
  function stateKey(rater) { return `${prefix}rater:${encodeURIComponent(rater)}`; }
  function shuffle(items) {
    const list = [...items];
    // Rejection sampling avoids modulo bias in the random system order.
    const random = new Uint32Array(1);
    for (let i = list.length - 1; i > 0; i--) {
      const limit = Math.floor(4294967296 / (i + 1)) * (i + 1);
      do { crypto.getRandomValues(random); } while (random[0] >= limit);
      const j = random[0] % (i + 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
  function newState(rater) {
    return {
      schema_version:1, dataset_fingerprint:study.fingerprint, rater_id:rater,
      created_at:new Date().toISOString(), updated_at:new Date().toISOString(), current_sample:0,
      orders:Object.fromEntries(study.samples.map(s => [s.id, shuffle(s.outputs.map(o => o.id))])),
      ratings:{}
    };
  }
  function validRating(d, value) {
    return Number.isInteger(value) && (d.binary ? value === 0 || value === 1 : value >= 1 && value <= 5);
  }
  function validate(saved, rater) {
    if (!saved || saved.schema_version !== 1 || saved.dataset_fingerprint !== study.fingerprint || saved.rater_id !== rater || !saved.orders || !saved.ratings || typeof saved.ratings !== 'object') return false;
    if (!Number.isInteger(saved.current_sample) || saved.current_sample < 0 || saved.current_sample >= study.samples.length) return false;
    const ids = new Set();
    for (const sample of study.samples) {
      const order = saved.orders[sample.id];
      if (!Array.isArray(order) || order.length !== 4 || new Set(order).size !== 4 || order.some(id => !sample.outputs.some(o => o.id === id))) return false;
      sample.outputs.forEach(o => ids.add(o.id));
    }
    for (const [id, rating] of Object.entries(saved.ratings)) {
      if (!ids.has(id) || !rating || typeof rating !== 'object') return false;
      for (const [key, value] of Object.entries(rating)) {
        const d = dimensions.find(d => d.id === key);
        if (!d || !validRating(d, value)) return false;
      }
    }
    return true;
  }
  function persist() {
    if (!state) return;
    state.updated_at = new Date().toISOString();
    state.current_sample = index;
    if (storageSet(stateKey(state.rater_id), JSON.stringify(state))) {
      status(`Saved in this browser for ${state.rater_id}. Export a file to send your ratings.`);
    } else {
      status('Browser storage is unavailable or full. Your ratings are in memory only — export a backup before closing this page.', true);
    }
  }
  function activateRater() {
    const rater = $('rater').value.trim();
    if (state && state.rater_id === rater) { renderSample(false); updateProgress(); return; }
    if (state) persist();
    document.querySelectorAll('audio').forEach(a => a.pause());
    state = null;
    index = 0;
    if (!rater) {
      storageSet(lastRaterKey, '');
      status('Enter your assigned rater ID to begin. Use the same ID and browser to resume.');
    } else {
      const raw = storageGet(stateKey(rater));
      try {
        const saved = raw ? JSON.parse(raw) : null;
        if (raw && !validate(saved, rater)) throw new Error('Invalid saved session');
        state = saved || newState(rater);
        index = state.current_sample;
        storageSet(lastRaterKey, rater);
        persist();
        if (raw && storageAvailable) status(`Previous ratings restored for ${rater}. System order is unchanged.`);
      } catch (_) {
        status('The saved session could not be read. It has been preserved. Contact the study coordinator or use a different rater ID.', true);
      }
    }
    renderSample(false);
    updateProgress();
  }
  function currentOrder(sample) { return state ? state.orders[sample.id] : sample.outputs.map(o => o.id); }
  function ratingCount(sample) {
    return sample.outputs.reduce((n, output) => n + dimensions.filter(d => validRating(d, state?.ratings[output.id]?.[d.id])).length, 0);
  }
  function updateProgress() {
    let count = 0, complete = 0;
    for (const [i, sample] of study.samples.entries()) {
      const n = ratingCount(sample);
      count += n;
      if (n === 24) complete++;
      const button = $('sample-nav').children[i];
      button.classList.toggle('current', i === index);
      button.classList.toggle('complete', n === 24);
      button.classList.toggle('partial', n > 0 && n < 24);
      button.setAttribute('aria-label', `Sample ${i + 1}, ${n} of 24 ratings`);
      if (i === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    $('progress-label').textContent = `${count} / ${total} ratings (${Math.round(100 * count / total)}%)`;
    $('completion').textContent = `${complete} / ${study.samples.length} samples fully rated · ${count}/${total} ratings`;
    const ready = !!state && $('rater').value.trim() === state.rater_id;
    $('export-json').disabled = !ready;
    $('export-csv').disabled = !ready;
    $('clear').disabled = !ready;
    $('previous').disabled = index === 0;
    $('next').disabled = index === study.samples.length - 1;
    $('position').textContent = `Sample ${index + 1} of ${study.samples.length}`;
  }
  function transcript(turns, title) {
    const box = el('div', 'transcript');
    box.append(el('h4', '', title));
    if (!turns.length) box.append(el('p', '', 'No speech recognized by ASR. Please judge the audio itself.'));
    turns.forEach(turn => {
      const row = el('div', 'turn');
      row.append(el('span', 'speaker', (turn.speaker || '').replace('Speaker ', 'S')), el('span', '', turn.text));
      box.append(row);
    });
    return box;
  }
  function audioPlayer(file, label) {
    const audio = el('audio');
    audio.controls = true;
    audio.preload = 'none';
    audio.src = file;
    audio.setAttribute('aria-label', label);
    audio.append(document.createTextNode('Your browser does not support audio playback.'));
    audio.addEventListener('error', () => status('An audio file could not be loaded. Check your connection and reload; existing ratings are saved.', true));
    return audio;
  }
  function ratingRow(output, d, systemLabel) {
    const row = el('div', 'rating-row');
    const description = el('div', 'rating-description');
    const title = el('span', 'rating-title', d.title);
    title.id = `title-${output.id}-${d.id}`;
    description.append(title, el('p', '', d.description));
    const control = el('div', 'rating-control');
    const options = el('div', `rating-options${d.binary ? ' binary' : ''}`);
    options.setAttribute('role', 'radiogroup');
    options.setAttribute('aria-labelledby', title.id);
    const values = d.binary ? [0, 1] : [1, 2, 3, 4, 5];
    values.forEach(value => {
      const choice = el('label', 'rating-choice');
      const input = el('input');
      input.type = 'radio';
      input.name = `${output.id}:${d.id}`;
      input.value = String(value);
      input.checked = state?.ratings[output.id]?.[d.id] === value;
      input.disabled = !state || $('rater').value.trim() !== state.rater_id;
      input.setAttribute('aria-label', `${systemLabel}, ${d.title}, ${value}`);
      input.addEventListener('change', () => {
        if (!state || $('rater').value.trim() !== state.rater_id) return;
        state.ratings[output.id] ||= {};
        state.ratings[output.id][d.id] = value;
        persist();
        updateProgress();
      });
      choice.append(input, el('span', '', String(value)));
      options.append(choice);
    });
    const anchors = el('div', 'scale-anchors');
    anchors.append(el('span', '', d.low), el('span', '', d.high));
    control.append(options, anchors);
    row.append(description, control);
    return row;
  }
  function renderSample(scroll) {
    document.querySelectorAll('audio').forEach(a => a.pause());
    const sample = study.samples[index];
    const root = $('sample');
    root.replaceChildren();
    const heading = el('h2', 'sample-heading');
    heading.append(el('span', 'counter', `Sample ${index + 1} / ${study.samples.length}`), el('span', 'sample-id', sample.id));
    [sample.direction.replace('-', ' → '), sample.dataset, `${sample.source.transcript.length} turns`].forEach(t => heading.append(el('span', 'chip', t)));
    const source = el('section', 'source-card');
    source.append(el('h3', '', '▶ SOURCE — the original. Reference for voice & turns; not rated.'), audioPlayer(sample.source.audio, 'Source audio'), transcript(sample.source.transcript, `Source transcript (${sample.direction.split('-')[0].toUpperCase()})`));
    root.append(heading, source, el('h3', 'outputs-heading', 'SYSTEM OUTPUTS — RATE ALL 4'));
    currentOrder(sample).forEach((id, position) => {
      const output = sample.outputs.find(o => o.id === id);
      const name = `System ${String.fromCharCode(65 + position)}`;
      const card = el('section', 'system-card');
      card.dataset.outputId = id;
      card.append(el('h3', '', name), audioPlayer(output.audio, `${name} translated audio`), transcript(output.transcript, `Transcription of this output (${sample.direction.split('-')[1].toUpperCase()}, automatic speech recognition)`));
      dimensions.forEach(d => card.append(ratingRow(output, d, name)));
      root.append(card);
    });
    if (scroll) root.scrollIntoView({ block:'start' });
  }
  function goTo(i) {
    if (i < 0 || i >= study.samples.length) return;
    index = i;
    if (state) persist();
    renderSample(true);
    updateProgress();
  }
  function rows() {
    return study.samples.flatMap((sample, i) => currentOrder(sample).map((id, position) => ({
      rater_id:state.rater_id, dataset_fingerprint:study.fingerprint, sample_number:i + 1,
      sample_id:sample.id, direction:sample.direction, dataset:sample.dataset,
      system_label:`System ${String.fromCharCode(65 + position)}`, output_id:id,
      ...Object.fromEntries(dimensions.map(d => [d.id, state.ratings[id]?.[d.id] ?? ''])),
      updated_at:state.updated_at
    })));
  }
  function csvCell(value) {
    let s = String(value);
    // Prevent a spreadsheet from executing a rater name as a formula.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  }
  function exportFile(format) {
    if (!state || $('rater').value.trim() !== state.rater_id) return;
    persist();
    const result = rows();
    let body;
    if (format === 'json') {
      body = JSON.stringify({ schema_version:1, dataset_fingerprint:study.fingerprint, rater_id:state.rater_id, exported_at:new Date().toISOString(), ratings:result }, null, 2);
    } else {
      const keys = Object.keys(result[0]);
      body = '\uFEFF' + [keys.map(csvCell).join(','), ...result.map(row => keys.map(k => csvCell(row[k])).join(','))].join('\r\n') + '\r\n';
    }
    if (downloadURL) URL.revokeObjectURL(downloadURL);
    downloadURL = URL.createObjectURL(new Blob([body], { type:format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' }));
    const a = el('a');
    a.href = downloadURL;
    const safeRater = state.rater_id.replace(/[^\p{L}\p{N}_-]/gu, '_').slice(0, 60) || 'rater';
    a.download = `s2st_ratings_${safeRater}_${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
    document.body.append(a);
    a.click();
    a.remove();
    if (storageAvailable) status('Export downloaded. Send the file to the study coordinator; nothing was submitted automatically.');
  }
  dimensions.forEach(d => {
    const definition = el('div', 'dimension-definition');
    const p = el('p', '', d.description + ' ');
    p.append(el('em', '', `(${d.low}, ${d.high})`));
    definition.append(el('strong', '', d.title), p);
    $('rubric-dimensions').append(definition);
  });
  study.samples.forEach((_, i) => {
    const button = el('button', '', String(i + 1));
    button.addEventListener('click', () => goTo(i));
    $('sample-nav').append(button);
  });
  $('rater').addEventListener('input', () => {
    const matches = !!state && $('rater').value.trim() === state.rater_id;
    document.querySelectorAll('.rating-choice input').forEach(i => i.disabled = !matches);
    updateProgress();
    if (!matches) status('Press Enter or leave the ID field to start or restore this rater’s session.');
  });
  $('rater').addEventListener('change', activateRater);
  $('rater').addEventListener('keydown', e => { if (e.key === 'Enter') { $('rater').blur(); activateRater(); } });
  $('previous').addEventListener('click', () => goTo(index - 1));
  $('next').addEventListener('click', () => goTo(index + 1));
  $('export-json').addEventListener('click', () => exportFile('json'));
  $('export-csv').addEventListener('click', () => exportFile('csv'));
  $('clear').addEventListener('click', () => {
    if (!state || !confirm(`Clear all ratings for ${state.rater_id} on this browser? Export a backup first if needed. Other raters are not affected.`)) return;
    state.ratings = {};
    // Preserve the existing assignment when clearing ratings.
    persist(); renderSample(false); updateProgress();
  });
  document.addEventListener('play', e => {
    if (e.target.tagName === 'AUDIO') document.querySelectorAll('audio').forEach(a => { if (a !== e.target) a.pause(); });
  }, true);
  window.addEventListener('storage', e => {
    if (state && e.key === stateKey(state.rater_id)) {
      // Keep multiple tabs for the same rater from silently overwriting progress.
      try {
        const saved = JSON.parse(e.newValue);
        if (!validate(saved, state.rater_id)) return;
        state = saved;
        index = state.current_sample;
        renderSample(false); updateProgress();
        status('Progress updated from another tab for this rater.');
      } catch (_) { status('Another tab changed this session. Export a backup and reload before continuing.', true); }
    }
  });
  const lastRater = storageGet(lastRaterKey);
  if (lastRater) { $('rater').value = lastRater; activateRater(); }
  else { renderSample(false); updateProgress(); }
})();
