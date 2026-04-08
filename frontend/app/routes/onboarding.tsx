import React, { useState } from "react";
import { Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getSession } from "~/services/session.server";
import { dynamo, USERS_TABLE } from "~/services/dynamodb.server";
import "./onboarding.css";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get("user")!;
  const groups = user.groups ?? [];
  return { groups, cognitoName: user.name ?? "" };
}

type FieldErrors = Partial<Record<string, string>>;

function validate(formData: FormData, groups: string[]): FieldErrors {
  const errors: FieldErrors = {};

  const name = (formData.get("name") as string)?.trim();
  if (!name) errors.name = "Name is required.";

  const age = Number(formData.get("age"));
  if (!formData.get("age")) errors.age = "Age is required.";
  else if (isNaN(age) || age < 10 || age > 100) errors.age = "Age must be between 10 and 100.";

  const sex = formData.get("sex") as string;
  if (!sex) errors.sex = "Please select a sex.";

  if (groups.includes("player")) {
    const height = Number(formData.get("height"));
    if (!formData.get("height")) errors.height = "Height is required.";
    else if (isNaN(height) || height < 100 || height > 250) errors.height = "Height must be between 100 and 250 cm.";

    const weight = Number(formData.get("weight"));
    if (!formData.get("weight")) errors.weight = "Weight is required.";
    else if (isNaN(weight) || weight < 30 || weight > 200) errors.weight = "Weight must be between 30 and 200 kg.";
  }

  return errors;
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get("user")!;
  const groups = user.groups ?? [];

  const formData = await request.formData();
  const errors = validate(formData, groups);

  if (Object.keys(errors).length > 0) {
    return {
      errors,
      values: Object.fromEntries(formData),
      formError: null,
    };
  }

  const item: Record<string, unknown> = {
    userId: user.id,
    name: (formData.get("name") as string).trim(),
    age: Number(formData.get("age")),
    sex: formData.get("sex") as string,
    followList: [],
    onboardingComplete: true,
    createdAt: new Date().toISOString(),
  };

  if (groups.includes("player")) {
    item.height = Number(formData.get("height"));
    item.weight = Number(formData.get("weight"));
  }

  try {
    await dynamo.send(new PutCommand({ TableName: USERS_TABLE, Item: item }));
  } catch (err) {
    console.error("[onboarding] DynamoDB write failed:", err);
    return {
      errors: {} as FieldErrors,
      values: Object.fromEntries(formData),
      formError: "Something went wrong saving your profile. Please try again.",
    };
  }

  if (groups.includes("admin")) throw redirect("/admin/dashboard");
  if (groups.includes("coach")) throw redirect("/coach/dashboard");
  if (groups.includes("player")) throw redirect("/player/home");
  throw redirect("/feed");
}

export default function OnboardingPage() {
  const { groups, cognitoName } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const values = actionData?.values ?? {};
  const [sex, setSex] = useState((values.sex as string) ?? "");
  const [nameEditing, setNameEditing] = useState(false);
  const [nameValue, setNameValue] = useState((values.name as string) || cognitoName);
  const [clientErrors, setClientErrors] = useState<Partial<Record<string, string>>>({});

  const errors = Object.keys(clientErrors).length > 0 ? clientErrors : (actionData?.errors ?? {});
  const isPlayer = groups.includes("player");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const errs: Partial<Record<string, string>> = {};

    if (!nameValue.trim()) errs.name = "Name is required.";

    const form = e.currentTarget;
    const ageRaw = (form.elements.namedItem("age") as HTMLInputElement)?.value;
    const age = Number(ageRaw);
    if (!ageRaw) errs.age = "Age is required.";
    else if (isNaN(age) || age < 10 || age > 100) errs.age = "Age must be between 10 and 100.";

    if (!sex) errs.sex = "Please select a sex.";

    if (isPlayer) {
      const heightRaw = (form.elements.namedItem("height") as HTMLInputElement)?.value;
      const height = Number(heightRaw);
      if (!heightRaw) errs.height = "Height is required.";
      else if (isNaN(height) || height < 100 || height > 250) errs.height = "Height must be between 100 and 250 cm.";

      const weightRaw = (form.elements.namedItem("weight") as HTMLInputElement)?.value;
      const weight = Number(weightRaw);
      if (!weightRaw) errs.weight = "Weight is required.";
      else if (isNaN(weight) || weight < 30 || weight > 200) errs.weight = "Weight must be between 30 and 200 kg.";
    }

    if (Object.keys(errs).length > 0) {
      e.preventDefault();
      setClientErrors(errs);
    }
  }

  return (
    <div className="onboardingPage">
      <div className="onboardingHeader">
        <div className="onboardingInner">
          <div className="onboardingEyebrow">Baller</div>
          <h1 className="onboardingTitle">Set up your profile</h1>
          <p className="onboardingSubtitle">
            Tell us a bit about yourself to get started.
          </p>
        </div>
      </div>

      <div className="onboardingContent">
        {actionData?.formError && (
          <div className="onboardingFormError">{actionData.formError}</div>
        )}

        <Form method="post" onSubmit={handleSubmit}>
          <section className="onboardingSection">
            <h2 className="onboardingSectionTitle">Basic info</h2>

            <div className="onboardingField">
              <label className="onboardingLabel" htmlFor="name">Full name</label>
              <div className="onboardingInputWrap">
                {nameEditing ? (
                  <input
                    id="name"
                    name="name"
                    type="text"
                    className={`onboardingInput onboardingInputWithIcon${errors.name ? " onboardingInputError" : ""}`}
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    autoComplete="off"
                    autoFocus
                  />
                ) : (
                  <>
                    <div className={`onboardingInputReadonly onboardingInputWithIcon${errors.name ? " onboardingInputError" : ""}`}>
                      {nameValue || <span className="onboardingInputPlaceholder">e.g. LeBron James</span>}
                    </div>
                    <input type="hidden" name="name" value={nameValue} />
                  </>
                )}
                <button
                  type="button"
                  className={`onboardingPencilBtn${nameEditing ? " onboardingPencilBtnActive" : ""}`}
                  onClick={() => setNameEditing((v) => !v)}
                  aria-label={nameEditing ? "Confirm name" : "Edit name"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                  </svg>
                </button>
              </div>
              {errors.name && <p className="onboardingFieldError">{errors.name}</p>}
            </div>

            <div className="onboardingField">
              <label className="onboardingLabel" htmlFor="age">Age</label>
              <input
                id="age"
                name="age"
                type="number"
                className={`onboardingInput${errors.age ? " onboardingInputError" : ""}`}
                defaultValue={values.age as string ?? ""}
                placeholder="e.g. 25"
                min={10}
                max={100}
              />
              {errors.age && <p className="onboardingFieldError">{errors.age}</p>}
            </div>

            <div className="onboardingField">
              <label className="onboardingLabel">Sex</label>
              <div className="onboardingRadioGroup">
                {(["male", "female", "other"] as const).map((option) => (
                  <label
                    key={option}
                    className={`onboardingRadioCard${sex === option ? " onboardingRadioCardSelected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="sex"
                      value={option}
                      checked={sex === option}
                      onChange={() => setSex(option)}
                    />
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </label>
                ))}
              </div>
              {errors.sex && <p className="onboardingFieldError">{errors.sex}</p>}
            </div>
          </section>

          {isPlayer && (
            <section className="onboardingSection">
              <h2 className="onboardingSectionTitle">Physical stats</h2>

              <div className="onboardingField">
                <label className="onboardingLabel" htmlFor="height">Height (cm)</label>
                <input
                  id="height"
                  name="height"
                  type="number"
                  className={`onboardingInput${errors.height ? " onboardingInputError" : ""}`}
                  defaultValue={values.height as string ?? ""}
                  placeholder="e.g. 193"
                  min={100}
                  max={250}
                />
                {errors.height && <p className="onboardingFieldError">{errors.height}</p>}
              </div>

              <div className="onboardingField">
                <label className="onboardingLabel" htmlFor="weight">Weight (kg)</label>
                <input
                  id="weight"
                  name="weight"
                  type="number"
                  className={`onboardingInput${errors.weight ? " onboardingInputError" : ""}`}
                  defaultValue={values.weight as string ?? ""}
                  placeholder="e.g. 90"
                  min={30}
                  max={200}
                />
                {errors.weight && <p className="onboardingFieldError">{errors.weight}</p>}
              </div>
            </section>
          )}

          <div className="onboardingActions">
            <button
              type="submit"
              className="onboardingSubmit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving…" : "Continue"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
