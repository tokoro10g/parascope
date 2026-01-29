import type React from 'react';
import { useEffect, useState } from 'react';
import { API_BASE, api, type SheetVersion } from '../../api';
import { Modal } from '../Modal';
import { AIGenerator } from './AIGenerator';
import { DescriptionEditor } from './DescriptionEditor';
import { FunctionEditor } from './FunctionEditor';
import { LUTEditor } from './LUTEditor';
import { TypeConfig } from './TypeConfig';
import type { NodeUpdates } from './types';

interface NodeInspectorProps {
  node: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, updates: NodeUpdates) => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  node,
  isOpen,
  onClose,
  onSave,
}) => {
  const [label, setLabel] = useState('');
  const [data, setData] = useState<Record<string, any>>({});
  const [inputs, setInputs] = useState<{ key: string; socket_type: string }[]>(
    [],
  );
  const [outputs, setOutputs] = useState<
    { key: string; socket_type: string }[]
  >([]);
  const [showPreview, setShowPreview] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [versions, setVersions] = useState<SheetVersion[]>([]);

  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiUrls, setAiUrls] = useState('');
  const [aiImage, setAiImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiAvailableProviders, setAiAvailableProviders] = useState<string[]>(
    [],
  );
  const [aiSelectedProvider, setAiSelectedProvider] = useState<string>('');

  useEffect(() => {
    api.getGenAIConfig().then((config) => {
      setAiEnabled(config.enabled);
      setAiAvailableProviders(config.available_providers || []);
      setAiSelectedProvider(config.default_provider || '');
    });
  }, []);

  useEffect(() => {
    if (node) {
      setDataLoaded(false);
      setLabel(node.label);
      setAiPrompt('');
      setAiUrls('');
      setAiImage(null);
      setVersions([]);

      const currentData = { ...(node.data || {}) };

      if (node.type === 'sheet' && currentData.sheetId) {
        api.listSheetVersions(currentData.sheetId).then(setVersions);
      }

      // Initialize defaults for new fields to avoid leaking state from previous node
      currentData.dataType = currentData.dataType || 'any';
      currentData.options = currentData.options || [];
      currentData.min = currentData.min !== undefined ? currentData.min : undefined;
      currentData.max = currentData.max !== undefined ? currentData.max : undefined;

      // Sync value from control if it exists, as it might be newer than data
      if (node.controls.value) {
        const control = node.controls.value as any;
        // Check if control has a value property (it should for InputControl)
        if (control && control.value !== undefined) {
          currentData.value = control.value;
        }
      }

      setData(currentData);
      // We need to extract inputs/outputs from the node structure
      // Rete nodes store inputs/outputs as objects, but we want arrays for editing
      setInputs(
        Object.keys(node.inputs).map((key) => ({ key, socket_type: 'any' })),
      );
      setOutputs(
        Object.keys(node.outputs).map((key) => ({ key, socket_type: 'any' })),
      );
      setDataLoaded(true);
    }
  }, [node]);

  if (!isOpen || !node) return null;

  const transformUrl = (url: string) => {
    if (
      url.startsWith('/attachments/') ||
      url.startsWith('/api/v1/attachments/')
    ) {
      const normalizedUrl = url.startsWith('/attachments/')
        ? `/api/v1${url}`
        : url;
      return `${API_BASE}${normalizedUrl}`;
    }
    return url;
  };

  const getAttachmentUrl = (filename: string) => {
    return `/api/v1/attachments/${filename}`;
  };

  const handleSave = () => {
    onSave(node.id, {
      label,
      data,
      inputs,
      outputs,
    });
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      try {
        const result = await api.uploadAttachment(e.target.files[0]);
        setData({ ...data, attachment: result.filename });
      } catch (error) {
        console.error('Upload failed:', error);
        alert('Failed to upload attachment');
      }
    }
  };

  const handleRemoveAttachment = async () => {
    if (data.attachment) {
      try {
        await api.deleteAttachment(data.attachment);
      } catch (error) {
        console.error('Delete failed:', error);
        // We continue anyway to clear the UI state if the file is already gone or there's a minor error
      }
    }
    const newData = { ...data };
    delete newData.attachment;
    setData(newData);
  };

  const handleInsertToDescription = () => {
    if (!data.attachment) return;
    const url = getAttachmentUrl(data.attachment);
    const markdownImage = `![Attachment](${url})`;

    setData((prev) => ({
      ...prev,
      description: prev.description
        ? `${prev.description}\n\n${markdownImage}`
        : markdownImage,
    }));
  };

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const urls = aiUrls
        .split('\n')
        .map((u) => u.trim())
        .filter((u) => u);

      const result = await api.generateFunction(
        aiPrompt,
        data.code,
        urls,
        aiImage || undefined,
        data.description,
        aiSelectedProvider,
      );
      setData((prev) => ({
        ...prev,
        code: result.code,
        description: result.description,
      }));
      setLabel(result.title);
      setInputs(result.inputs.map((k) => ({ key: k, socket_type: 'any' })));
      setOutputs(result.outputs.map((k) => ({ key: k, socket_type: 'any' })));
    } catch (e: any) {
      console.error(e);
      alert(`AI Generation failed: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const footer = (
    <>
      <button type="button" onClick={onClose} className="btn">
        Cancel
      </button>
      <button type="button" onClick={handleSave} className="btn primary">
        Save
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Node: ${node.type}`}
      footer={footer}
    >
      {node.type === 'function' && (
        <AIGenerator
          aiPrompt={aiPrompt}
          setAiPrompt={setAiPrompt}
          aiUrls={aiUrls}
          setAiUrls={setAiUrls}
          aiImage={aiImage}
          setAiImage={setAiImage}
          isGenerating={isGenerating}
          handleGenerate={handleGenerate}
          aiEnabled={aiEnabled}
          hasExistingContent={!!(data.code || data.description)}
          availableProviders={aiAvailableProviders}
          selectedProvider={aiSelectedProvider}
          setSelectedProvider={setAiSelectedProvider}
        />
      )}

      <div className="form-group">
        <label htmlFor="node-label">Label:</label>
        <input
          id="node-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={isGenerating}
        />
      </div>

      {node.type === 'sheet' && (
        <div className="form-group">
          <label htmlFor="sheet-version">Logic Version:</label>
          <select
            id="sheet-version"
            value={data.versionId || ''}
            onChange={(e) => {
              const vid = e.target.value || null;
              const tag = versions.find((v) => v.id === vid)?.version_tag;
              setData({ ...data, versionId: vid, versionTag: tag });
            }}
          >
            <option value="">Live (Latest Draft)</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.version_tag} ({new Date(v.created_at).toLocaleDateString()})
              </option>
            ))}
          </select>
          <p
            className="help-text"
            style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}
          >
            Choose "Live" for agile concurrent work, or a specific version to
            freeze the logic.
          </p>
        </div>
      )}

      {dataLoaded && (
        <>
          {node.type !== 'sheet' && (
            <DescriptionEditor
              data={data}
              setData={setData}
              showPreview={showPreview}
              setShowPreview={setShowPreview}
              isGenerating={isGenerating}
              transformUrl={transformUrl}
              getAttachmentUrl={getAttachmentUrl}
              handleFileUpload={handleFileUpload}
              handleInsertToDescription={handleInsertToDescription}
              handleRemoveAttachment={handleRemoveAttachment}
            />
          )}

          {(node.type === 'constant' ||
            node.type === 'input' ||
            node.type === 'output') && (
            <TypeConfig
              nodeType={node.type}
              data={data}
              setData={setData}
              inputs={inputs}
              setInputs={setInputs}
            />
          )}

          {node.type === 'function' && (
            <FunctionEditor
              data={data}
              setData={setData}
              inputs={inputs}
              setInputs={setInputs}
              outputs={outputs}
              setOutputs={setOutputs}
              isGenerating={isGenerating}
            />
          )}

          {node.type === 'lut' && (
            <LUTEditor
              data={data}
              setData={setData}
              outputs={outputs}
              setOutputs={setOutputs}
              setInputs={setInputs}
            />
          )}
        </>
      )}
    </Modal>
  );
};
