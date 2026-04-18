import { TONE_PRESETS, type TonePreset } from "../types";

const TONE_PRESET_COPY: Record<TonePreset, { description: string; label: string }> = {
  natural: {
    label: "Natural",
    description: "Keep the page close to the original photo with only your slider changes.",
  },
  grayscale: {
    label: "Grayscale",
    description: "Remove color while preserving softer pencil and print detail.",
  },
  high_contrast_bw: {
    label: "High Contrast B/W",
    description: "Push the page toward pure black and white for strong printed separation.",
  },
  printer_friendly: {
    label: "Printer Friendly",
    description: "Boost legibility with a print-oriented grayscale cleanup baseline.",
  },
};

interface ToneControlsProps {
  brightness: number;
  contrast: number;
  disabled: boolean;
  hasUnsavedChanges: boolean;
  preset: TonePreset;
  resetDisabled: boolean;
  resetLabel: string;
  saveDisabled: boolean;
  saveLabel: string;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onPresetChange: (value: TonePreset) => void;
  onReset: () => void;
  onSave: () => void;
}

function formatSliderValue(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

export function ToneControls({
  brightness,
  contrast,
  disabled,
  hasUnsavedChanges,
  preset,
  resetDisabled,
  resetLabel,
  saveDisabled,
  saveLabel,
  onBrightnessChange,
  onContrastChange,
  onPresetChange,
  onReset,
  onSave,
}: ToneControlsProps) {
  return (
    <div className="tone-controls">
      <div className="tone-preset-grid" role="radiogroup" aria-label="Tone preset">
        {TONE_PRESETS.map((tonePreset) => {
          const copy = TONE_PRESET_COPY[tonePreset];

          return (
            <button
              key={tonePreset}
              className={`tone-preset-card${preset === tonePreset ? " is-active" : ""}`}
              type="button"
              role="radio"
              aria-checked={preset === tonePreset}
              disabled={disabled}
              onClick={() => {
                onPresetChange(tonePreset);
              }}
            >
              <span className="tone-preset-title">{copy.label}</span>
              <span className="tone-preset-description">{copy.description}</span>
            </button>
          );
        })}
      </div>

      <div className="tone-slider-list">
        <label className="tone-slider-control">
          <span className="tone-slider-label">
            Brightness
            <strong>{formatSliderValue(brightness)}</strong>
          </span>
          <input
            type="range"
            min={-100}
            max={100}
            step={1}
            value={brightness}
            disabled={disabled}
            onChange={(event) => {
              onBrightnessChange(Number(event.target.value));
            }}
          />
        </label>

        <label className="tone-slider-control">
          <span className="tone-slider-label">
            Contrast
            <strong>{formatSliderValue(contrast)}</strong>
          </span>
          <input
            type="range"
            min={-100}
            max={100}
            step={1}
            value={contrast}
            disabled={disabled}
            onChange={(event) => {
              onContrastChange(Number(event.target.value));
            }}
          />
        </label>
      </div>

      <div className="tone-controls-footer">
        <p className="tone-controls-status">
          {hasUnsavedChanges
            ? "Unsaved tone changes are local until you save."
            : "Tone controls match the saved backend state."}
        </p>

        <div className="editor-actions">
          <button
            className="primary-action"
            type="button"
            disabled={saveDisabled}
            onClick={onSave}
          >
            {saveLabel}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={resetDisabled}
            onClick={onReset}
          >
            {resetLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
