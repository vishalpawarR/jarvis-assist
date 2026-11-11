const container = document.getElementById("custom-personal-fields");
const standardFieldKeys = new Set(["fullName", "email", "phone", "location", "linkedin"]);

function getCustomFields(personalInfo) {
  const fields = Array.isArray(personalInfo.customFields)
    ? personalInfo.customFields
        .filter((field) => field && typeof field.label === "string")
        .map((field, index) => ({
          id: String(field.id || `custom-${index}`),
          label: field.label,
          value: String(field.value ?? ""),
        }))
    : [];

  for (const [key, value] of Object.entries(personalInfo)) {
    if (
      !standardFieldKeys.has(key) &&
      key !== "customFields" &&
      key !== "updatedAt" &&
      typeof value === "string" &&
      value.trim()
    ) {
      fields.push({ id: `legacy-${key}`, label: key, value });
    }
  }
  return fields;
}

function addField(field = {}) {
  const row = document.createElement("div");
  row.className = "custom-personal-field";
  row.dataset.fieldId = field.id || crypto.randomUUID();

  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.className = "custom-field-label";
  labelInput.placeholder = "Field name (e.g. Portfolio)";
  labelInput.setAttribute("aria-label", "Custom field name");
  labelInput.value = field.label ?? "";
  labelInput.required = true;

  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.className = "custom-field-value";
  valueInput.placeholder = "Your information";
  valueInput.setAttribute("aria-label", "Custom field value");
  valueInput.value = field.value ?? "";
  valueInput.required = true;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "button button-danger";
  removeButton.textContent = "Remove";
  removeButton.setAttribute("aria-label", "Remove custom field");
  removeButton.addEventListener("click", () => row.remove());

  row.append(labelInput, valueInput, removeButton);
  container.append(row);
}

export function renderCustomFields(personalInfo) {
  const fields = getCustomFields(personalInfo);
  container.replaceChildren();
  for (const field of fields) {
    addField(field);
  }
  return fields;
}

export function collectCustomFields() {
  return [...container.querySelectorAll(".custom-personal-field")]
    .map((row) => ({
      id: row.dataset.fieldId,
      label: row.querySelector(".custom-field-label").value.trim(),
      value: row.querySelector(".custom-field-value").value.trim(),
    }))
    .filter((field) => field.label && field.value);
}

export function initializeCustomFields() {
  document.getElementById("add-personal-field").addEventListener("click", () => {
    addField();
    container.lastElementChild.querySelector(".custom-field-label").focus();
  });
}
