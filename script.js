let orders = [];
// this is the logic for packer
// DOM refs
const fileInput = document.getElementById('fileInput');
const orderList = document.getElementById('orderList');
const searchInput = document.getElementById('searchInput');

// Buttons
document.getElementById('darkModeBtn').onclick = () => {
  document.body.classList.toggle('dark-mode');
};

document.getElementById('exportBtn').onclick = exportData;
document.getElementById('clearBtn').onclick = clearAll;
document.getElementById('chat-icon').onclick = toggleChat;
searchInput.addEventListener('keyup', filter);

// File upload
fileInput.addEventListener('change', handleFile);

// =====================
// CORE LOGIC
// =====================

function handleFile(e) {
  
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: 'array' });
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });

    const map = new Map();

    raw.forEach(row => {
      const id = row.Name;

      if (!map.has(id)) {
        map.set(id, {
          id,
          customer: row['Billing Name'] || "N/A",
          items: [],
          itemMap: {}
        });
      }

      const order = map.get(id);

      const itemKey = row['Lineitem name']?.toLowerCase().trim();

      if (!order.itemMap[itemKey]) {
        order.itemMap[itemKey] = {
          name: row['Lineitem name'],
          qty: Number(row['Lineitem quantity']),
          fulfilledQty: Number(row['Lineitem fulfilled quantity']) || 0,
          packedQty: 0,
          vendor: row['Vendor'] || "Unknown",
          fulfillmentStatus: row['Lineitem fulfillment status']?.toLowerCase() || 'unfulfilled',
          rowRef: row
        };
      }
    });

    orders = Array.from(map.values()).map(order => {
        order.items = Object.values(order.itemMap);
        delete order.itemMap;
        return order;
      });
    render();
  };

  reader.readAsArrayBuffer(file);
}

function render() {
  orderList.innerHTML = '';

  orders.forEach((order, oIdx) => {
  const packedCount = order.items.filter(item => {
    const remainingQty = item.qty - (item.fulfilledQty || 0);
    return item.packedQty === remainingQty;
  }).length;

  const isComplete = packedCount === order.items.length && order.items.length > 0;
  const isPartial = packedCount > 0 && packedCount < order.items.length;

  const card = document.createElement('div');

  card.className = `order-card ${
    isComplete ? 'complete' : isPartial ? 'partial' : ''
  }`;

  card.innerHTML = `
    <div><b>Order ${order.id}</b></div>
    <div>${order.customer}</div>
    <div>Checked: ${packedCount}/${order.items.length}</div>
  `;

order.items.forEach((item, iIdx) => {
  const remainingQty = item.qty - (item.fulfilledQty || 0);

  let statusLabel = '';

  if (item.fulfillmentStatus === 'fulfilled') {
    statusLabel = `<span class="fulfilled-label">Fulfilled</span>`;
  } else if (item.fulfillmentStatus === 'partial') {
    statusLabel = `<span class="partial-label">Partial</span>`;
  } else {
    statusLabel = `<span class="unfulfilled-label">Unfulfilled</span>`;
  }
  const row = document.createElement('div');
  row.className = 'item-row';

    row.innerHTML = `
      <span class="item-name">${item.name}</span>
      <span class="vendor">${item.vendor}</span>

      <input 
        type="number" 
        min="0" 
        max="${remainingQty}" 
        value="${item.packedQty}" 
        class="qty-input"
      >
      <button class="full-btn">FULL</button>

      <b>x${remainingQty}</b>
      ${statusLabel}
    `;

  const input = row.querySelector('input');
  const fullBtn = row.querySelector('.full-btn');

  if (fullBtn) {
    fullBtn.addEventListener('click', () => {
      orders[oIdx].items[iIdx].packedQty = remainingQty;

      render();
      filter();
    });
  }

  if (input) {
    input.addEventListener('input', (e) => {
      let val = Number(e.target.value);

      if (val > remainingQty) val = remainingQty;
      if (val < 0) val = 0;

      orders[oIdx].items[iIdx].packedQty = val;

      const currentOrder = oIdx;
      const currentItem = iIdx;

      render();
      filter();

      const cards = document.querySelectorAll('.order-card');
      const targetCard = cards[currentOrder];

      if (targetCard) {
        const inputs = targetCard.querySelectorAll('.qty-input');
        const targetInput = inputs[currentItem];

        if (targetInput) {
          targetInput.focus();
          targetInput.select();
        }
      }
    });
  }

  card.appendChild(row); // 🔥 THIS WAS MISSING
});
orderList.appendChild(card); // 🔥 VERY IMPORTANT

  }); // 🔥 CLOSE LOOP

}


function exportData() {
  if (!orders.length) return alert("No data");

  const final = [];

  orders.forEach(o => {
  o.items.forEach(i => {

    const remainingQty = i.qty - (i.fulfilledQty || 0);

    let status =
      remainingQty === 0
        ? 'Already Fulfilled'
        : i.packedQty === remainingQty
        ? 'Packed'
        : i.packedQty > 0
        ? 'Partial'
        : 'Pending';

    final.push({
      Order: o.id,
      Customer: o.customer,
      Item: i.name,
      Vendor: i.vendor,
      Fulfillment: i.fulfillmentStatus,
      Ordered: i.qty,
      Packed: i.packedQty,
      Missing: remainingQty - i.packedQty,
      Status: status
    });

  });
});

  const ws = XLSX.utils.json_to_sheet(final);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");

  XLSX.writeFile(wb, `Packing_Report.xlsx`);
}

function clearAll() {
  if (confirm("Clear all orders?")) {
    orders = [];
    render();
  }
}

function filter() {
  const q = searchInput.value.toLowerCase();

  document.querySelectorAll('.order-card').forEach(c => {
    c.style.display = c.innerText.toLowerCase().includes(q) ? 'block' : 'none';
  });
}

function toggleChat() {
  const f = document.getElementById('chat-frame');
  f.style.display = f.style.display === 'block' ? 'none' : 'block';
}

// this vendor ordering logic
function getProcurementData() {
  const result = {};

  orders.forEach(order => {
    order.items.forEach(item => {
      const vendor = item.vendor;
      const name = item.name;
      const qty = item.qty;

      if (!result[vendor]) {
        result[vendor] = {};
      }

      if (!result[vendor][name]) {
        result[vendor][name] = 0;
      }

      result[vendor][name] += qty;
    });
  });

  return result;
}

// Render procurement view


function renderProcurement() {
  const data = getProcurementData();

  orderList.innerHTML = '';

  Object.keys(data).forEach(vendor => {
    const card = document.createElement('div');
    card.className = 'order-card';

    let itemsHtml = `<div><b>${vendor}</b></div>`;

    Object.keys(data[vendor]).forEach(item => {
      itemsHtml += `
        <div class="item-row">
          <span>${item}</span>
          <b>x${data[vendor][item]}</b>
        </div>
      `;
    });

    card.innerHTML = itemsHtml;
    orderList.appendChild(card);
  });
}

document.getElementById('procurementBtn').onclick = renderProcurement;

function exportProcurement() {
  const data = getProcurementData();
  const final = [];

  Object.keys(data).forEach(vendor => {
    Object.keys(data[vendor]).forEach(item => {
      final.push({
        Vendor: vendor,
        Item: item,
        Total_Quantity: data[vendor][item]
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(final);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Procurement");

  XLSX.writeFile(wb, `Procurement_Report.xlsx`);
}

document.getElementById('packingViewBtn').onclick = render;
document.getElementById('exportProcurementBtn').onclick = exportProcurement;