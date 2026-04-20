export default function AdminHelp() {
  return (
    <article className="prose max-w-3xl">
      <h1>Editor handbook</h1>

      <h2>What is a "root"?</h2>
      <p>
        One of the 162 SSB entries Heruni enumerates in Appendix 10: 39 single letters, 86
        two-letter combinations, and 37 three-letter combinations. The table is fixed — you cannot
        add or remove entries. You can edit the Armenian and English gloss lists, the symbol, the
        see-also links, and the editor notes.
      </p>

      <h2>Adding a new word</h2>
      <ol>
        <li>Go to <strong>Words → New word</strong>.</li>
        <li>Type the Armenian word. Click <strong>Propose split</strong>.</li>
        <li>The system runs a greedy longest-match (3-letter, then 2-letter, then 1-letter) against
          the roots table. Review the decomposition. You can override any field.</li>
        <li>Write the reconstructed meaning in both Armenian and English. Keep the gloss short —
          one or two sentences.</li>
        <li>Choose a category, source (e.g. <code>book p.115</code>, <code>editor</code>), and
          confidence (1 = from book, 2 = editor certain, 3 = editor tentative).</li>
        <li>Set status. <code>draft</code> is private; <code>review</code> is queued for a second
          editor; <code>published</code> appears on the public site.</li>
        <li>Click <strong>Save</strong>.</li>
      </ol>

      <h2>Confidence levels</h2>
      <ul>
        <li><strong>1 — From book</strong>: the decomposition and meaning come directly from
          Heruni's Chapter 2.7 examples.</li>
        <li><strong>2 — Editor certain</strong>: you followed Heruni's method closely and are
          confident in the result.</li>
        <li><strong>3 — Editor tentative</strong>: the decomposition is uncertain. Publish only if
          it's useful and clearly marked.</li>
      </ul>

      <h2>Status workflow</h2>
      <p>
        <code>draft → review → published</code>. A second editor's approval before moving to
        <code>published</code> is recommended but not enforced (v1.0).
      </p>

      <h2>Editing an existing word</h2>
      <p>
        Every save creates an audit log entry. Soft-delete flips status to <code>draft</code> and
        prefixes the slug so the public URL disappears; an admin can restore later.
      </p>

      <h2>Approving a submission</h2>
      <p>
        Go to <strong>Submissions</strong>. Open a pending submission, copy the proposed
        decomposition/meaning into <strong>Words → New word</strong>, and set the source to
        <code>submission #{'{id}'}</code>.
      </p>
    </article>
  );
}
