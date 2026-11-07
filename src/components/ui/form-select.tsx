"use client";
import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Select, type SelectProps } from "./select";

/**
 * <Select> bound to a react-hook-form field. Use it directly inside <Field> so
 * the label, hint and error ids reach the combobox button.
 */
export function FormSelect<T extends FieldValues>({
  control, name, ...props
}: { control: Control<T>; name: FieldPath<T> } & Omit<SelectProps, "value" | "onValueChange">) {
  const { field } = useController({ control, name });
  return <Select {...props} value={(field.value as string | undefined) ?? ""} onValueChange={field.onChange} />;
}
