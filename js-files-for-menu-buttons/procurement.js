// =============================
// 📦 STATE (DATA)
// =============================

// Orders from packing page
let orders = JSON.parse(localStorage.getItem('orders')) || [];

// Inventory from uploaded file
let inventory = JSON.parse(localStorage.getItem('inventory')) || {};

// =============================
// 📌 DOM ELEMENTS
// =============================

const orderList = document.getElementById('orderList');
const fileInput = document.getElementById('fileInput');
const inventoryInput = document.getElementById('inventoryInput');
const clearBtn = document.getElementById('clearBtn');
const inventoryStatus = document.getElementById('inventoryFileName');

// =============================
// 🧹 CLEAR BUTTON
// =============================

clearBtn.onclick = () => {
  if (confirm('Clear procurement data?')) {
    localStorage.removeItem('orders');
    orders = [];
    orderList.innerHTML = '';
  }
};

// =============================
// 📦 INVENTORY UPLOAD
// =============================

inventoryInput.addEventListener('change', handleInventory);

function handleInventory(e) {
  const file = e.target.files[0];

  if (!file) {
    alert('Please select an inventory file');
    return;
  }

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

      // detect correct columns automatically
      const nameKey = keys.find((k) => k.toLowerCase().includes('name'));
      const stockKey = keys.find(
        (k) =>
          k.toLowerCase().includes('stock') || k.toLowerCase().includes('رصيد'),
      );

      const name = row[nameKey]?.toLowerCase().trim();
      const stock = Number(row[stockKey]) || 0;

      if (name) {
        map[name] = stock;
      }
    });

    inventory = map;

    localStorage.setItem('inventory', JSON.stringify(inventory));

    inventoryStatus.textContent = '✅ Inventory loaded';

    renderProcurement();
  };

  reader.readAsArrayBuffer(file);
}

// =============================
// 📤 ORDERS UPLOAD (OPTIONAL)
// =============================

fileInput.addEventListener('change', handleFile);

function handleFile(e) {
  const file = e.target.files[0];
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
          customer: row['Billing Name'] || 'N/A',
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
// 📊 RENDER PROCUREMENT
// =============================

function renderProcurement() {
  // 🚨 if no inventory → stop everything
  if (Object.keys(inventory).length === 0) {
    orderList.innerHTML = `
      <div class="order-card">
        <b style="color:red;">
          ⚠️ Upload inventory file first
        </b>
      </div>
    `;
    return;
  }

  orderList.innerHTML = '';

  const result = {};

  // =============================
  // 🔢 GROUP ORDERS
  // =============================

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
  // 🧱 BUILD UI
  // =============================

  Object.keys(result).forEach((vendor) => {
    const card = document.createElement('div');
    card.className = 'order-card';

    let html = `<div><b>${vendor}</b></div>`;

    Object.keys(result[vendor]).forEach((item) => {
      const total = result[vendor][item];
      const key = item.toLowerCase().trim();

      // match inventory
      let stock = inventory[key];

      // fallback match
      if (stock === undefined) {
        const match = Object.keys(inventory).find(
          (invKey) => invKey.includes(key) || key.includes(invKey),
        );

        if (match) stock = inventory[match];
      }

      if (stock === undefined) stock = 0;

      const need = Math.max(0, total - stock);

      // optional: skip items already covered
      // if (need === 0) return;

      html += `
        <div class="item-row">
          <div class="item-name"><b>${item}</b></div>

          <div class="item-meta">
            <span>Order: ${total}</span>
            <span>Stock: ${stock}</span>
            <span class="need">Need: ${need}</span>
          </div>
        </div>
      `;
    });

    card.innerHTML = html;
    orderList.appendChild(card);
  });
}

// =============================
// 🚀 INITIAL LOAD
// =============================

document.addEventListener('DOMContentLoaded', renderProcurement);
