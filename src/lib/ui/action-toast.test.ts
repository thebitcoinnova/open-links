import assert from "node:assert/strict";
import test from "node:test";
import {
  type ActionToastClient,
  resolveActionToastDescriptor,
  showActionToast,
} from "./action-toast";

const createRecordingClient = () => {
  const calls: Array<{ message: string; variant: "default" | "error" }> = [];

  const client: ActionToastClient = {
    default: (message) => {
      calls.push({ message, variant: "default" });
    },
    error: (message) => {
      calls.push({ message, variant: "error" });
    },
  };

  return { calls, client };
};

test("resolveActionToastDescriptor stays silent for dismissed results", () => {
  assert.equal(
    resolveActionToastDescriptor({
      message: "",
      status: "dismissed",
    }),
    undefined,
  );
});

test("resolveActionToastDescriptor uses a fallback success message for blank copy results", () => {
  assert.deepEqual(
    resolveActionToastDescriptor({
      message: "   ",
      status: "copied",
    }),
    {
      message: "Copied",
      variant: "default",
    },
  );
});

test("showActionToast routes shared results to the default toast when they carry a message", () => {
  const { calls, client } = createRecordingClient();

  const didToast = showActionToast(
    {
      message: "GitHub link shared",
      status: "shared",
    },
    client,
  );

  assert.equal(didToast, true);
  assert.deepEqual(calls, [{ message: "GitHub link shared", variant: "default" }]);
});

test("showActionToast stays silent for shared results with blank messages", () => {
  const { calls, client } = createRecordingClient();

  const didToast = showActionToast(
    {
      message: "",
      status: "shared",
    },
    client,
  );

  assert.equal(didToast, false);
  assert.deepEqual(calls, []);
});

test("showActionToast routes copied results to the default toast", () => {
  const { calls, client } = createRecordingClient();

  const didToast = showActionToast(
    {
      message: "Link copied",
      status: "copied",
    },
    client,
  );

  assert.equal(didToast, true);
  assert.deepEqual(calls, [{ message: "Link copied", variant: "default" }]);
});

test("showActionToast routes failed results to error", () => {
  const { calls, client } = createRecordingClient();

  const didToast = showActionToast(
    {
      message: "Share failed",
      status: "failed",
    },
    client,
  );

  assert.equal(didToast, true);
  assert.deepEqual(calls, [{ message: "Share failed", variant: "error" }]);
});

test("showActionToast ignores undefined results", () => {
  const { calls, client } = createRecordingClient();

  const didToast = showActionToast(undefined, client);

  assert.equal(didToast, false);
  assert.deepEqual(calls, []);
});
