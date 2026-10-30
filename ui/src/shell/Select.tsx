// 轻量自定义下拉：保留 combobox/listbox 语义，不依赖原生 select 的浏览器样式。

import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  id: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  "aria-label"?: string;
  class?: string;
  disabled?: boolean;
}

export function Select({ id, value, options, onChange, "aria-label": ariaLabel, class: className, disabled = false }: SelectProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = options[selectedIndex];
  const listboxId = id + "-listbox";

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const option = document.getElementById(`${id}-option-${activeIndex}`);
    option?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, id, open]);

  const move = (step: number): void => {
    if (options.length === 0) return;
    setActiveIndex((index) => (index + step + options.length) % options.length);
  };

  const choose = (index: number): void => {
    const option = options[index];
    if (option === undefined) return;
    onChange(option.value);
    setActiveIndex(index);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) {
          setActiveIndex(selectedIndex);
          setOpen(true);
        } else move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) {
          setActiveIndex(selectedIndex);
          setOpen(true);
        } else move(-1);
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActiveIndex(Math.max(0, options.length - 1));
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) choose(activeIndex);
        else {
          setActiveIndex(selectedIndex);
          setOpen(true);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} class={`custom-select${className === undefined ? "" : ` ${className}`}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        class="custom-select__trigger"
        value={value}
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && options[activeIndex] !== undefined ? `${id}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => {
          setActiveIndex(selectedIndex);
          setOpen((shown) => !shown);
        }}
        onKeyDown={onKeyDown}
      >
        <span class="custom-select__value">{selected?.label ?? value}</span>
        <span class="custom-select__chevron" aria-hidden="true">⌄</span>
      </button>
      {open && options.length > 0 && (
        <div id={listboxId} class="custom-select__menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => (
            <div
              id={`${id}-option-${index}`}
              class="custom-select__option"
              role="option"
              aria-selected={option.value === value}
              data-active={index === activeIndex}
              data-value={option.value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {option.value === value && <span class="custom-select__check" aria-hidden="true">✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
