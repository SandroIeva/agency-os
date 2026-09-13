# Deleting data and resetting settings

Deleting a file, disconnecting Instagram, resetting an API key, and deleting your account affect different data. This guide helps you choose the action that matches your intention and understand what remains afterwards.

This is a practical product guide. The [Privacy Policy](https://www.i7os.com/privacy) explains data processing, retention and your rights. For a personal-data deletion request, use the [deletion instructions](https://www.i7os.com/privacy#data-deletion) or contact [support@i7os.com](mailto:support@i7os.com).

### Choose the right action

| Your intention                                   | Appropriate action                                                        | What it does not do                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Stop i7OS from using a connected social account  | Disconnect that account; revoke its permissions at the provider if needed | Delete posts already published on the platform                   |
| Remove one document, image, moodboard or project | Use that item's delete action                                             | Delete unrelated copies, exports or your entire account          |
| Replace an AI provider key                       | Remove or replace the key in Settings                                     | Revoke the key at its provider or delete previous requests there |
| Return a visual setting to its default           | Use Reset for that setting                                                | Delete the underlying workspace or its content                   |
| Fix a local browser problem                      | Save your work, reload, and if necessary clear this site's browser data   | Erase data stored on i7OS servers                                |
| Start a separate, empty environment              | Create a new workspace, subject to your plan                              | Clear the existing workspace                                     |
| Remove a shared workspace entirely               | Delete that workspace as an administrator                                 | Delete the external accounts connected to it                     |
| Stop using i7OS and remove your personal account | Delete your account after reviewing the affected workspaces               | Automatically delete content already sent to external services   |

### Before deleting shared data

Check the active workspace and the name of the item you are about to delete. A project or workspace can contain other members' work, not just your own uploads.

Save or download anything you need to keep using the export or download functions available for that content. A screenshot or a browser tab is not a backup of an editable document. Inform affected collaborators before removing shared content.

Read the confirmation dialog. Actions described as permanent should be treated as irreversible. If an editor offers Undo or version history, use it for changes within that editor; it is not a promise that a deleted workspace or account can be restored.

### Disconnect Instagram or Threads

These instructions apply to the direct Meta connections. Other social connections may use a different provider or connection flow.

#### Disconnect in i7OS

1. Switch to the workspace that contains the connection.
2. Open **Settings → Account**.
3. Find **Instagram** or **Threads**.
4. Select **Disconnect** for the relevant connection.
5. Check that the connected account is no longer displayed. If you see an error, refresh the view and verify the connection state before relying on the deletion.

The connection is shared by the workspace. Removing it also stops other members from using that connection. If the same external account is connected in another workspace, check that workspace separately.

Removing the active connection record removes the access token, account ID, username, token expiry, permissions, workspace association and other connection metadata. Logging out of i7OS does not perform this deletion.

#### Remove access through Meta

You can also remove i7OS from the connected apps or website permissions in your Instagram or Threads account settings. When Meta sends i7OS a deauthorization or data-deletion notification, i7OS removes connection records associated with that platform account.

Disconnecting inside i7OS and withdrawing permission at Meta are related but distinct actions. If you want to withdraw the provider-side permission as well, review the authorized apps in your Meta account.

#### What remains after disconnecting?

* **Published posts remain on Instagram or Threads.** Delete them on the respective platform if you want them removed.
* **Files and documents created in i7OS remain.** Remove these separately if that is your intention.
* **Your Instagram or Threads account remains.** Disconnecting does not close the account at Meta.
* **Other workspace data remains.** Disconnecting is not a workspace reset.

A temporary media link expiring is also not a deletion request. When i7OS supplies Meta with a one-hour link to media in private storage, expiry prevents future access through that link. It does not remove a copy already retrieved by Meta or delete the source file from i7OS. Public media URLs do not automatically receive this one-hour limit.

For details of the data processed by the direct integration, see sections 4.7, 6.6 and 8.1 of the [Privacy Policy](https://www.i7os.com/privacy).

### Delete individual content

Open the relevant area, select the item and use its **Delete** action where available. The exact location depends on the view, for example an item menu or a confirmation dialog.

#### Files, documents and imported images

A file can exist in several places: as an original at a provider, as an imported i7OS copy, as a document attachment, or as a downloaded export. Deleting one item does not establish that every copy has been erased.

For example, importing a Google Drive file into i7OS creates a copy. Deleting that copy is a separate action from deleting the original in Drive. Similarly, removing a Pinterest image from a moodboard is not a request to delete the original Pinterest pin.

For a request covering all copies of personal data, contact support and identify the relevant workspace and content.

#### Moodboards, artboards and projects

Check whether the delete action targets an element, a board, a document containing several artboards, or an entire project. These scopes differ. Removing a container can affect the content inside it and other collaborators' access.

Removing an image from the Social Media Post composer removes it from that composition. It does not, by itself, remove its source asset or a post already published externally.

#### Shared contributions

Removing a member's access is different from deleting everything they contributed. Shared content may remain available to the team. If content itself must be removed, address the relevant objects or contact support with a specific request.

#### Assistant conversations

Use the delete action in the assistant's conversation list to remove a saved conversation from this browser. The current conversation history is stored locally, so check other browsers and devices separately.

Starting a new conversation is not the same as deleting the previous one. Deleting a conversation also does not, by itself, delete documents created during it, shared workspace knowledge, separately stored assistant memories, or request data already processed by an AI provider. Specify those data separately in a deletion request.

### Reset settings without deleting your work

#### Visual and editor settings

A **Reset** control applies to the setting beside it. Examples include an editor's zoom, working-area background, an object's transformation, or an OS visual customization.

Resetting a visual customization restores the default appearance or removes its assignment. Do not treat this as confirmation that an uploaded source file has also been deleted. Delete the asset separately if required.

#### AI provider keys

In **Settings → AI models**, open the relevant provider's key field. Use its **Reset** control to remove the key saved by i7OS, or replace it with a new one.

The current key preference is stored in that browser's local storage. Check other browsers or devices where you entered the key separately. Removing it from i7OS does not revoke the original key at the provider. To invalidate a key, use the provider's own key-management page.

Resetting a key does not delete existing i7OS documents, generated images, or a request history held by the provider. Those require separate actions.

#### Browser data and signing out

Start with a reload if a view looks outdated. If you need to clear site data, save pending work first, then use your browser's settings for the specific i7OS site.

Clearing browser data can remove sign-in state, preferences and locally stored keys. It does not delete your i7OS account, shared workspace data, uploaded server files or workspace-level Meta connections. It is not a substitute for a data-deletion request.

#### Starting over

For a separate clean start, create a new workspace if your plan allows it. Keep the old one until you have moved or downloaded what you need. Deleting and recreating a workspace is a destructive change, not a way to recover its former content.

### Delete an entire workspace

Only an administrator of that workspace can perform this action.

1. Switch to the workspace you intend to remove.
2. Open **Settings → Account** and locate **Delete workspace**.
3. Review the warning and the workspace name.
4. Enter the workspace name as requested.
5. Confirm only after saving what you need and coordinating with affected members.

The deletion process removes the workspace and its associated data, including projects, tasks, brand information and memberships, and attempts to clean up stored workspace assets. Other members lose access too. A network or storage error can require follow-up; contact support if you need confirmation that a particular file has been removed.

Your personal account and other workspaces are separate from this action. Also review billing separately: deleting a workspace is not a substitute for checking or cancelling a subscription in billing settings.

### Delete your personal i7OS account

Account deletion has a wider effect than disconnecting an integration.

1. Save the content you need and review all workspaces you created.
2. Remove relevant external connections explicitly, especially those in workspaces that will remain in use by others.
3. Open **Settings → Account** and select **Delete account**. If you created workspaces, the action may be labelled **Delete account & workspaces**.
4. Read the list of affected workspaces and the warning about shared data.
5. Enter your account email address as requested and confirm.

The current deletion flow also removes workspaces you created, including shared ones. Your contribution to someone else's workspace can remain without attribution to your account; deleting your account is not a blanket deletion of that workspace's shared work.

Before removing your account, i7OS requests cancellation of the associated subscription at the end of its paid period. If that cancellation fails, the flow stops and reports an error. Later cleanup steps can also fail, so do not assume that an error means nothing changed. Contact support with the error and affected workspace.

Once deletion completes, you are signed out. Do not rely on being able to undo this action. Retention periods described in the Privacy Policy are not a self-service recovery feature.

### Request deletion without account access

Email [support@i7os.com](mailto:support@i7os.com). Include:

* The email address associated with your i7OS account, if known.
* The workspace name and the specific data you want removed.
* For social connections, the platform and account username.
* Whether you are requesting removal of a connection, particular content, or your entire account.

Do not send passwords, access tokens, API keys or unnecessary identity documents. Support may request information needed to verify your authority to make the request. For connected-account deletion requests, we process the request within 30 days and confirm completion by email, as described in the Privacy Policy.

Example:

> Please delete the direct Threads connection for @example in the Example workspace. I no longer have access to i7OS. My i7OS account email is name@example.com. This request concerns the connection and its stored account data, not deletion of the entire workspace. Please confirm completion.

### Confirm the result

After an ordinary item deletion or disconnection, refresh the relevant view. Check that you are looking at the same workspace and account. If the item remains, or an error appeared, contact support rather than using a broader destructive action as a workaround.

For content already shared externally, check the destination service separately. If you need a formal response about personal data, request confirmation from support; an empty screen alone is not evidence that all retained copies have been erased.



