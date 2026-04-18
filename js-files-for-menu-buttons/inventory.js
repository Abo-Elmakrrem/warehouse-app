// =============================
// 📦 STATE (DATA)
// =============================

// inventory stored in localStorage
let inventory = JSON.parse(localStorage.getItem('inventory')) || {};

// =============================
// 📌 DOM ELEMENTS
// =============================

const inventoryUpload = document.getElementById('inventoryUpload');
const table = document.getElementById('inventoryTable');
const searchInput = document.getElementById('searchInput');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const addBtn = document.getElementById('addBtn');

// =============================
// 📊 MAIN RENDER (FULL TABLE)
// =============================

function render(keys = Object.keys(inventory)) {
  table.innerHTML = '';

  keys.forEach((key) => {
    const item = inventory[key];

    const row = document.createElement('tr');

    row.innerHTML = `
      <td>
        <input 
          type="text"
          value="${item.vendor || ''}"
          class="vendor-input"
          data-key="${key}"
        >
      </td>

      <td>${item.name}</td>

      <td>
        <input 
          type="text"
          value="${item.sku || ''}"
          class="sku-input"
          data-key="${key}"
        >
      </td>

      <td>
        <input 
          type="number"
          value="${item.stock}"
          class="stock-input"
          data-key="${key}"
        >
      </td>
    `;

    table.appendChild(row);
  });
}

// =============================
// ➕ ADD NEW ITEM
// =============================

addBtn.onclick = () => {
  const name = prompt('Item name?');
  if (!name) return;

  const key = name.toLowerCase().trim();

  inventory[key] = {
    name,
    vendor: '',
    sku: '',
    stock: 0,
  };

  render();
};

// =============================
// ⚡ AUTO SAVE (REAL-TIME)
// =============================

table.addEventListener('input', (e) => {
  const input = e.target;

  // only react to our inputs
  if (
    !input.classList.contains('stock-input') &&
    !input.classList.contains('vendor-input') &&
    !input.classList.contains('sku-input')
  )
    return;

  const key = input.dataset.key;

  // update correct field
  if (input.classList.contains('stock-input')) {
    inventory[key].stock = Number(input.value);
  }

  if (input.classList.contains('vendor-input')) {
    inventory[key].vendor = input.value;
  }

  if (input.classList.contains('sku-input')) {
    inventory[key].sku = input.value;
  }

  // save instantly
  localStorage.setItem('inventory', JSON.stringify(inventory));
});

// =============================
// 🧹 CLEAR INVENTORY
// =============================

clearBtn.onclick = () => {
  if (!confirm('Clear inventory?')) return;

  inventory = {};
  localStorage.removeItem('inventory');

  render();
};

// =============================
// 🔍 SEARCH (FAST + DEBOUNCED)
// =============================

let searchTimeout;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    const q = searchInput.value.toLowerCase();

    // if empty → show full table
    if (!q) {
      render();
      return;
    }

    const filteredKeys = Object.keys(inventory).filter((key) => {
      const item = inventory[key];

      return (
        item.name.toLowerCase().includes(q) ||
        item.vendor.toLowerCase().includes(q) ||
        (item.sku || '').toLowerCase().includes(q)
      );
    });

    render(filteredKeys);
  }, 200); // delay = smoother typing
});

// =============================
// 📤 UPLOAD INVENTORY FILE
// =============================

inventoryUpload.addEventListener('change', handleUpload);

function handleUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);

    const wb = XLSX.read(data, { type: 'array' });

    const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
      defval: '',
    });

    const map = {};

    raw.forEach((row) => {
      const keys = Object.keys(row);

      const nameKey = keys.find((k) => k.toLowerCase().includes('name'));

      const stockKey = keys.find(
        (k) =>
          k.toLowerCase().includes('stock') || k.toLowerCase().includes('رصيد'),
      );

      const vendorKey = keys.find(
        (k) =>
          k.toLowerCase().includes('vendor') ||
          k.toLowerCase().includes('supplier'),
      );

      if (!nameKey) return;

      const name = row[nameKey].toLowerCase().trim();
      const stock = Number(row[stockKey]) || 0;

      map[name] = {
        name: row[nameKey],
        vendor: vendorKey ? row[vendorKey] : '',
        sku: '',
        stock,
      };
    });

    inventory = map;

    localStorage.setItem('inventory', JSON.stringify(inventory));

    alert('✅ Inventory uploaded');

    render();
  };

  reader.readAsArrayBuffer(file);
}

// =============================
// 🚀 INITIAL LOAD
// =============================

render();
