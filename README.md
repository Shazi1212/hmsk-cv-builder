# CV Builder

Write your CV once and get a German Lebenslauf, a UK CV and a US résumé from it, in your browser, without an account
and without your data leaving your device.

**Use it free:** https://hmsk.life/tools/cv-builder/ (or straight to the app: https://hmsk.life/apps/cv-builder/)

![CV Builder](https://hmsk.life/assets/images/tools/cv-builder.png)

## What it does

- One form, three outputs, switch with one click:
  - **German Lebenslauf**: tabular (dates on the left), optional photo, personal data (date of birth, nationality,
    residence permit), "Ort, Datum" and a signature line. A4, 1 to 2 pages.
  - **UK CV**: no photo, date of birth, nationality or marital status; personal statement first. A4, 2 pages at most.
  - **US résumé**: one page, US Letter, single column, standard headings (Summary, Experience, Education, Skills),
    real text, no tables or images, so applicant tracking systems (ATS) can read it.
- Three templates per format (classic, modern, compact). The German modern template has a sidebar.
- Live preview with a page count and the page break marked; a warning when a format runs too long.
- Short tips per format (what employers in Germany, the UK and the US expect) and checks (missing statement, photo
  that will not be shown, and so on).
- Entries are sorted newest first in every format (can be switched off).
- PDF through the browser's print dialog ("Save as PDF"): the PDF holds real, selectable text with embedded fonts.
- Saves as you type in the browser (localStorage). JSON backup and restore. The photo is resized in the browser.
- English and German interface (`?lang=de`), works on phones.

## Quick start

Plain static files, no build step, no dependencies.

```sh
python3 -m http.server 8080 --directory public   # or: npm start
# open http://localhost:8080
```

Any static web server works. `public/config.js` sets where the links back to hmsk.life point.
Example CV: `/?demo=1` (in memory only, never touches what you stored). `?format=de|uk|us`, `?template=classic|modern|compact`.

Fonts (Newsreader, Public Sans for the app; Geist inside the CV document; SIL Open Font License) are in `public/fonts/`; the shared hmsk.life look is in `public/letterpress.css`.

## Tests

```sh
node --test tests/     # or: npm test
```

Covers date parsing and ranges per format, newest-first sorting, what each format shows and hides (no photo or date of
birth outside the German CV, no tables or images in the US résumé, standard headings), HTML escaping of every field,
backup import validation and file names.

## Data and privacy

Everything stays in your browser on your device (localStorage). Nothing is sent to a server, there is no tracking and
no account. Clearing the browser data deletes your CV, so keep a JSON backup.

## License

MIT, see `LICENSE`. Fonts: SIL Open Font License, see `public/fonts/OFL-*.txt`.
