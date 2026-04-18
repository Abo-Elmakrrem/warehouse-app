// =============================
// 📦 STATE (DATA)
// =============================

// orders from packing page
let orders = JSON.parse(localStorage.getItem('orders')) || [];

// inventory from inventory page
let inventory = JSON.parse(localStorage.getItem('inventory')) || {};

// ordered tracking (what is already ordered)
let orderedMap = JSON.parse(localStorage.getItem('orderedMap')) || {};

// rows used for export
let currentRows = [];

// =============================
// 📌 DOM ELEMENTS
// =============================

const orderList = document.getElementById('orderList');
const fileInput = document.getElementById('fileInput');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const inventoryStatus = document.getElementById('inventoryFileName');

// =============================
// 🧹 CLEAR BUTTON
// =============================

clearBtn.onclick = () => {
  if (!confirm('Clear procurement data?')) return;

  localStorage.removeItem('orders');
  orders = [];
  orderList.innerHTML = '';
};

// =============================
// 📤 UPLOAD ORDERS
// =============================

fileInput.addEventListener('change', handleFile);

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);

    const wb = XLSX.read(data, { type: 'array' });

    const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
      defval: '',
    });

    const map = new Map();

    raw.forEach((row) => {
      const id = row.Name;

      if (!map.has(id)) {
        map.set(id, {
          id,
          items: [],
          itemMap: {},
        });
      }

      const order = map.get(id);
      const itemKey = row['Lineitem name']?.toLowerCase().trim();

      if (!order.itemMap[itemKey]) {
        order.itemMap[itemKey] = {
          name: row['Lineitem name'],
          qty: Number(row['Lineitem quantity']),
          vendor: row['Vendor'] || 'Unknown',
        };
      }
    });

    orders = Array.from(map.values()).map((order) => {
      order.items = Object.values(order.itemMap);
      delete order.itemMap;
      return order;
    });

    localStorage.setItem('orders', JSON.stringify(orders));

    renderProcurement();
  };

  reader.readAsArrayBuffer(file);
}

// =============================
// 📊 MAIN RENDER FUNCTION
// =============================

function renderProcurement() {
  // 🚨 stop if no inventory
  if (Object.keys(inventory).length === 0) {
    orderList.innerHTML = `
      <tr>
        <td colspan="7" style="color:red; text-align:center;">
          ⚠️ Upload inventory first
        </td>
      </tr>
    `;
    return;
  }

  // clear table
  orderList.innerHTML = '';

  // =============================
  // 🔢 GROUP ORDERS
  // =============================

  const result = {};

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const vendor = item.vendor;
      const name = item.name;
      const qty = item.qty;

      if (!result[vendor]) result[vendor] = {};
      if (!result[vendor][name]) result[vendor][name] = 0;

      result[vendor][name] += qty;
    });
  });

  // =============================
  // 🧱 BUILD ROWS
  // =============================

  currentRows = [];

  Object.keys(result).forEach((vendor) => {
    Object.keys(result[vendor]).forEach((item) => {
      const total = result[vendor][item];
      const key = item.toLowerCase().trim();

      // match inventory
      let invItem = inventory[key];

      if (!invItem) {
        const match = Object.keys(inventory).find(
          (invKey) => invKey.includes(key) || key.includes(invKey),
        );
        if (match) invItem = inventory[match];
      }

      const stock = invItem?.stock || 0;
      const vendorName = invItem?.vendor || vendor;
      const sku = invItem?.sku || '—';

      const need = Math.max(0, total - stock);

      if (need === 0) return;

      currentRows.push({
        key,
        vendor: vendorName,
        item,
        sku,
        total,
        stock,
        need,
      });
    });
  });

  // =============================
  // 🔥 SORT BY PRIORITY
  // =============================

  currentRows.sort((a, b) => b.need - a.need);

  // =============================
  // 📭 EMPTY STATE
  // =============================

  if (currentRows.length === 0) {
    orderList.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;">
          No items need ordering ✅
        </td>
      </tr>
    `;
    return;
  }

  // =============================
  // 📊 RENDER TABLE
  // =============================

  currentRows.forEach((r) => {
    const row = document.createElement('tr');

    const isOrdered = orderedMap[r.key];

    const color = r.need > 10 ? 'red' : r.need > 5 ? 'orange' : 'black';

    row.innerHTML = `
      <td>
        <input 
          type="checkbox"
          class="ordered-checkbox"
          data-key="${r.key}"
          ${isOrdered ? 'checked' : ''}
        >
      </td>

      <td>${r.vendor}</td>
      <td>${r.item}</td>
      <td>${r.sku}</td>
      <td>${r.total}</td>
      <td>${r.stock}</td>
      <td style="color:${color}; font-weight:bold;">
        ${r.need}
      </td>
    `;

    // ✅ SIMPLE VISUAL FEEDBACK
    if (isOrdered) {
      row.style.background = '#f3f3f3';
    }

    orderList.appendChild(row);
  });

  // show count
  inventoryStatus.textContent = `${currentRows.length} items to order`;
}

// =============================
// ✅ ORDERED TRACKING
// =============================

orderList.addEventListener('change', (e) => {
  if (!e.target.classList.contains('ordered-checkbox')) return;

  const key = e.target.dataset.key;

  orderedMap[key] = e.target.checked;

  localStorage.setItem('orderedMap', JSON.stringify(orderedMap));

  renderProcurement();
});

// =============================
// 📥 EXPORT
// =============================

exportBtn.addEventListener('click', () => {
  if (!currentRows.length) {
    alert('No data to export');
    return;
  }

  const data = currentRows
    .filter((r) => !orderedMap[r.key]) // only NOT ordered
    .map((r) => ({
      Vendor: r.vendor,
      Item: r.item,
      SKU: r.sku,
      'Order Qty': r.total,
      Stock: r.stock,
      Need: r.need,
    }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, 'Procurement');

  XLSX.writeFile(wb, 'procurement_report.xlsx');
});

// =============================
// 🚀 INIT
// =============================

document.addEventListener('DOMContentLoaded', renderProcurement);
