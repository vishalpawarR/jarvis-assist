"use client";

import { useState } from "react";
import type { Json } from "@/lib/supabase/database.types";
import { savePersonalDetails } from "./actions";

type CustomField = { id: string; label: string; value: string };
type PersonalDetails = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  customFields: CustomField[];
};

function isRecord(value: Json | null): value is { [key: string]: Json | undefined } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readDetails(value: Json | null): PersonalDetails {
  if (!isRecord(value)) {
    return { fullName: "", email: "", phone: "", location: "", linkedin: "", customFields: [] };
  }
  const text = (key: string) => (typeof value[key] === "string" ? value[key] : "");
  const customFields = Array.isArray(value.customFields)
    ? value.customFields.flatMap((field): CustomField[] => {
        if (
          field === null ||
          Array.isArray(field) ||
          typeof field !== "object" ||
          typeof field.id !== "string" ||
          typeof field.label !== "string" ||
          typeof field.value !== "string"
        ) {
          return [];
        }
        return [{ id: field.id, label: field.label, value: field.value }];
      })
    : [];
  return {
    fullName: text("fullName"),
    email: text("email"),
    phone: text("phone"),
    location: text("location"),
    linkedin: text("linkedin"),
    customFields,
  };
}

export function PersonalDetailsForm({ details }: { details: Json | null }) {
  const initial = readDetails(details);
  const [customFields, setCustomFields] = useState(initial.customFields);

  function updateField(id: string, key: "label" | "value", value: string) {
    setCustomFields((fields) =>
      fields.map((field) => (field.id === id ? { ...field, [key]: value } : field)),
    );
  }

  return (
    <form action={savePersonalDetails} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          Full name
          <input
            className="form-input"
            name="fullName"
            defaultValue={initial.fullName}
            maxLength={200}
          />
        </label>
        <label className="field-label">
          Email
          <input
            className="form-input"
            name="email"
            type="email"
            defaultValue={initial.email}
            maxLength={254}
          />
        </label>
        <label className="field-label">
          Mobile number
          <input
            className="form-input"
            name="phone"
            type="tel"
            defaultValue={initial.phone}
            maxLength={80}
          />
        </label>
        <label className="field-label">
          Location
          <input
            className="form-input"
            name="location"
            defaultValue={initial.location}
            maxLength={200}
          />
        </label>
        <label className="field-label sm:col-span-2">
          LinkedIn URL
          <input
            className="form-input"
            name="linkedin"
            type="url"
            defaultValue={initial.linkedin}
            maxLength={2048}
          />
        </label>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-800">Custom fields</h3>
          <button
            className="button-secondary"
            onClick={() =>
              setCustomFields((fields) => [
                ...fields,
                { id: crypto.randomUUID(), label: "", value: "" },
              ])
            }
            type="button"
          >
            Add field
          </button>
        </div>
        {customFields.length === 0 && (
          <p className="text-sm text-slate-500">
            Add items such as a portfolio URL or work authorization.
          </p>
        )}
        {customFields.map((field) => (
          <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]" key={field.id}>
            <input
              aria-label="Custom field name"
              className="form-input"
              maxLength={100}
              onChange={(event) => updateField(field.id, "label", event.target.value)}
              placeholder="Field name"
              value={field.label}
            />
            <input
              aria-label="Custom field value"
              className="form-input"
              maxLength={1000}
              onChange={(event) => updateField(field.id, "value", event.target.value)}
              placeholder="Value"
              value={field.value}
            />
            <button
              aria-label={`Remove ${field.label || "custom field"}`}
              className="button-danger"
              onClick={() =>
                setCustomFields((fields) => fields.filter((item) => item.id !== field.id))
              }
              type="button"
            >
              Remove
            </button>
          </div>
        ))}
        <input name="customFields" type="hidden" value={JSON.stringify(customFields)} />
      </div>
      <button className="button-primary" type="submit">
        Save personal details
      </button>
    </form>
  );
}
