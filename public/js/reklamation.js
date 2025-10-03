const form = document.getElementById('reklamationsForm');
const itemsContainer = document.getElementById('itemsContainer');
const addItemButton = document.getElementById('addItemButton');
const feedbackEl = form?.querySelector('.form-feedback');
let itemIndex = 0;

const STATUS_CLASSES = ['success', 'error'];

function setFeedback(message, type = 'success') {
  if (!feedbackEl) return;
  STATUS_CLASSES.forEach((cls) => feedbackEl.classList.remove(cls));
  feedbackEl.textContent = message;
  if (message) {
    feedbackEl.classList.add(type);
  }
}

function createItem() {
  const index = itemIndex++;
  const wrapper = document.createElement('div');
  wrapper.className = 'reklamation-item';
  wrapper.dataset.index = String(index);
  wrapper.innerHTML = `
    <div class="reklamation-item__header">
      <h3>Reklamation <span>(${index + 1})</span></h3>
      <button type="button" class="remove-item" aria-label="Reklamation entfernen">Entfernen</button>
    </div>
    <label>
      Betroffener Bereich
      <input type="text" name="items[${index}][area]" placeholder="z. B. Hochschrank links" />
    </label>
    <label>
      Beschreibung*
      <textarea name="items[${index}][description]" rows="3" required placeholder="Bitte beschreiben Sie den Mangel"></textarea>
    </label>
    <div class="photo-input">
      <label for="photo-${index}">Foto hinzufügen*</label>
      <input id="photo-${index}" type="file" name="items[${index}][photo]" accept="image/*" capture="environment" required />
      <p class="photo-hint">Sie können die Kamera Ihres Smartphones verwenden. Bitte zeigen Sie auch den gesamten Schrank.</p>
    </div>
  `;

  wrapper.querySelector('.remove-item').addEventListener('click', () => {
    if (itemsContainer.children.length === 1) {
      setFeedback('Mindestens eine Reklamation wird benötigt.', 'error');
      return;
    }
    wrapper.remove();
    updateItemLabels();
  });

  itemsContainer.appendChild(wrapper);
  updateItemLabels();
}

function updateItemLabels() {
  const items = [...itemsContainer.children];
  items.forEach((item, index) => {
    const title = item.querySelector('h3 span');
    if (title) {
      title.textContent = `(${index + 1})`;
    }
    item.dataset.index = String(index);
    const areaInput = item.querySelector('input[type="text"]');
    const descriptionInput = item.querySelector('textarea');
    const fileInput = item.querySelector('input[type="file"]');
    const photoLabel = item.querySelector('label[for^="photo-"]');
    if (areaInput) {
      areaInput.name = `items[${index}][area]`;
    }
    if (descriptionInput) {
      descriptionInput.name = `items[${index}][description]`;
    }
    if (fileInput) {
      fileInput.name = `items[${index}][photo]`;
      const newId = `photo-${index}`;
      fileInput.id = newId;
      if (photoLabel) {
        photoLabel.setAttribute('for', newId);
      }
    }
  });
}

addItemButton?.addEventListener('click', () => {
  createItem();
});

if (itemsContainer && itemsContainer.children.length === 0) {
  createItem();
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setFeedback('');

  if (!form.checkValidity()) {
    setFeedback('Bitte prüfen Sie Ihre Angaben. Alle Pflichtfelder müssen ausgefüllt werden.', 'error');
    form.reportValidity();
    return;
  }

  const formData = new FormData(form);

  try {
    addItemButton.disabled = true;
    const response = await fetch('/api/reklamationen', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: 'Unbekannter Fehler' }));
      throw new Error(data.message || 'Unbekannter Fehler');
    }

    const result = await response.json();
    form.reset();
    itemsContainer.innerHTML = '';
    itemIndex = 0;
    createItem();
    setFeedback(`Vielen Dank! Ihr Ticket ${result.ticketNumber} wurde erstellt. Eine Bestätigung wurde per E-Mail versendet.`, 'success');
  } catch (error) {
    console.error(error);
    setFeedback(error.message || 'Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.', 'error');
  } finally {
    addItemButton.disabled = false;
  }
});
