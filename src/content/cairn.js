import { PDFDocument } from 'pdf-lib'
import { setOutline } from './outline';

const cairnChapters = document.querySelectorAll('.chapter-list a');

const process = async () => {
    const title = document.querySelector('.media .titre a')
    const progress = document.createElement("progress")
    progress.max = cairnChapters.length
    progress.value = 0
    progress.style.display = "block"
    if (title) title.insertAdjacentElement("afterend", progress);

    const merged = await PDFDocument.create();
    if (title?.textContent) merged.setTitle(title.textContent)

    const outline = []

    const download = async (href, title) => {
        const loc = new URL(href, window.location.toString())
        loc.pathname = loc.pathname.replace('feuilleter', 'load_pdf')
        loc.searchParams.set('download', '1')
        loc.searchParams.set('from-feuilleteur', '1')

        const dl = await fetch(loc.toString())
        const current = await PDFDocument.load(await dl.arrayBuffer())

        const copiedPages = await merged.copyPages(current, current.getPageIndices().slice(1));
        copiedPages.forEach((page, index) => {
            merged.addPage(page)
            if (index === 0) {
                outline.push({
                    title,
                    bold: true,
                    to: merged.getPageCount() - 1,
                })
            }
        });
    }

    // prepare progress ui
    document.querySelector('.chapter-list .active')?.classList.remove("active")
    const modal = document.getElementById("modal-chapters")
    if (modal) {
        modal.style.display = "block"
        modal.classList.add("in")
    }

    const spinnerContent = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"><animateTransform attributeName="transform" type="rotate" dur="0.75s" values="0 12 12;360 12 12" repeatCount="indefinite"/></path></svg>`

    for (const item of cairnChapters.values()) {

        const spinner = document.createElement("div")
        spinner.style.display = "inline"
        spinner.innerHTML = spinnerContent
        item.appendChild(spinner);

        const itemHref = item.getAttribute('href')
        const itemTitle = item.textContent.trim().replace(/\s\s+/g, ' (p. ').replace(/ -$/,')')
        await download(itemHref, itemTitle)

        progress.value = progress.value + 1
        item.removeChild(spinner)
    }

    progress.removeAttribute("value")
    setOutline(merged, outline)
    const pdfBytes = await merged.save();
    progress.remove()

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${merged.getTitle()}.pdf`;
    document.body.appendChild(link);
    link.click();
}

const processCatch = async (e) => {
    e.preventDefault();
    try {
        await process()
    } catch (error) {
        alert(`TÉLÉCHARGEMENT ÉCHOUÉ: ${error}`)
    }
}

if (cairnChapters) {
    const dlButton = document.createElement("a");
    dlButton.className = "btn btn-default";
    dlButton.textContent = `🤓 Téléchargement intégral`;
    dlButton.addEventListener("click", processCatch);

    document.querySelector(".chapters")?.insertAdjacentElement("afterend", dlButton);
}
