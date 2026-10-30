// 数据集输入框：统一候选列表、无浏览器自动填充和键盘提交行为。

import type { JSX } from "preact";

export interface DatasetInputProps {
  id: string;
  listId: string;
  value: string;
  options: readonly string[];
  onInput: (value: string, inputType: string | undefined) => void;
  onBlur?: (value: string) => void;
  onEnter?: (value: string) => void;
}

export function DatasetInput({ id, listId, value, options, onInput, onBlur, onEnter }: DatasetInputProps): JSX.Element {
  return (
    <>
      <input
        id={id}
        list={listId}
        autocomplete="off"
        aria-label="数据集"
        value={value}
        onInput={(event) => onInput(event.currentTarget.value, (event as InputEvent).inputType)}
        onBlur={onBlur === undefined ? undefined : (event) => onBlur(event.currentTarget.value)}
        onKeyDown={onEnter === undefined ? undefined : (event) => {
          if (event.key === "Enter") onEnter(event.currentTarget.value);
        }}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option value={option} />
        ))}
      </datalist>
    </>
  );
}
