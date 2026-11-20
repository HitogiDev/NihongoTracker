import { ChevronDown, Link2, Lock, Palette, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { PATREON_URL } from '../../constants/supportPlans';
import type {
  IPostDecoration,
  PostBackgroundPattern,
  PostBackgroundType,
  PostBorderStyle,
} from '../../types';
import {
  backgroundChoicePreview,
  type BackgroundImageChoice,
  backgroundLayerStyle,
  borderFrameStyle,
  POST_BACKGROUND_PATTERNS,
  POST_BACKGROUND_TYPES,
  POST_BORDER_STYLES,
  patternStyle,
} from '../../utils/postDecoration';
import {
  checkExternalImageUrl,
  POST_UPLOAD_MAX_BYTES,
  POST_UPLOAD_TYPES,
} from '../../utils/postAccess';
import Button from '../ui/Button';
import DropdownSelect from '../ui/DropdownSelect';
import Field from '../ui/Field';

interface PostDecorationEditorProps {
  value: IPostDecoration;
  onChange: (value: IPostDecoration) => void;
  image: BackgroundImageChoice;
  onImageChange: (image: BackgroundImageChoice) => void;
  /** Users without access see the section locked. */
  locked: boolean;
}

function ColorInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs">{label}</span>
      <input
        type="color"
        className="h-10 w-20 cursor-pointer surface disabled:cursor-not-allowed"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export default function PostDecorationEditor({
  value,
  onChange,
  image,
  onImageChange,
  locked,
}: PostDecorationEditorProps) {
  const { t } = useTranslation('social');
  const { t: tErrors } = useTranslation('errors');
  const [open, setOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { border, background } = value;

  const setBorder = (patch: Partial<IPostDecoration['border']>) =>
    onChange({ ...value, border: { ...border, ...patch } });
  const setBackground = (patch: Partial<IPostDecoration['background']>) =>
    onChange({ ...value, background: { ...background, ...patch } });

  const previewImage = backgroundChoicePreview(image);
  const frameStyle = borderFrameStyle(border);
  const layerStyle = backgroundLayerStyle(background, previewImage);

  const releaseFile = () => {
    if (image.kind === 'file') URL.revokeObjectURL(image.previewUrl);
  };

  const addLink = () => {
    const check = checkExternalImageUrl(linkValue);
    if (!check.ok) {
      setLinkError(
        check.reason === 'host'
          ? tErrors('post.unsupportedImageHost', { host: check.host })
          : tErrors('post.invalidImageUrl'),
      );
      return;
    }
    releaseFile();
    onImageChange({ kind: 'link', url: check.url });
    setLinkValue('');
    setLinkError('');
  };

  const chooseFile = (files: FileList | null) => {
    const file = files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    if (!POST_UPLOAD_TYPES.includes(file.type)) {
      toast.error(tErrors('post.invalidImage'));
      return;
    }
    if (file.size > POST_UPLOAD_MAX_BYTES) {
      toast.error(tErrors('post.imageTooLarge', { max: 8 }));
      return;
    }
    releaseFile();
    onImageChange({ kind: 'file', file, previewUrl: URL.createObjectURL(file) });
  };

  const removeImage = () => {
    releaseFile();
    onImageChange({ kind: 'none' });
  };

  return (
    <div className="surface-muted">
      <button
        type="button"
        className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Palette className="h-4 w-4 text-primary" />
        <span className="flex-1">{t('posts.decoration.title')}</span>
        {locked && <Lock className="h-4 w-4 text-warning" />}
        <ChevronDown
          className={open ? 'h-4 w-4 rotate-180 transition-transform' : 'h-4 w-4 transition-transform'}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-4 px-3 pb-3">
          {locked && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/70">
              <Lock className="h-4 w-4 shrink-0 text-warning" />
              <span className="min-w-0 flex-1">{t('posts.decoration.locked')}</span>
              <a
                href={PATREON_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-warning btn-outline btn-xs"
              >
                {t('posts.uploadLockedShort')}
              </a>
            </div>
          )}

          <div
            className={frameStyle ? 'rounded-box' : ''}
            style={frameStyle ?? undefined}
          >
            <div className="surface relative overflow-hidden p-4">
              {layerStyle && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={layerStyle}
                />
              )}
              <p className="relative text-sm font-medium">
                {t('posts.decoration.preview')}
              </p>
              <p className="relative text-xs text-base-content/70">
                {t('posts.decoration.previewBody')}
              </p>
            </div>
          </div>

          <fieldset disabled={locked} className="flex flex-col gap-4 disabled:opacity-60">
            <div className="flex flex-wrap items-end gap-4">
              <Field label={t('posts.decoration.border')} className="w-full sm:w-48">
                <DropdownSelect
                  className="select w-full"
                  value={border.style}
                  disabled={locked}
                  onChange={(event) =>
                    setBorder({ style: event.target.value as PostBorderStyle })
                  }
                >
                  {POST_BORDER_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {t(`posts.decoration.borderStyles.${style}`)}
                    </option>
                  ))}
                </DropdownSelect>
              </Field>
              {border.style !== 'none' && (
                <ColorInput
                  label={t('posts.decoration.color1')}
                  value={border.color1}
                  disabled={locked}
                  onChange={(color1) => setBorder({ color1 })}
                />
              )}
              {border.style === 'gradient' && (
                <ColorInput
                  label={t('posts.decoration.color2')}
                  value={border.color2}
                  disabled={locked}
                  onChange={(color2) => setBorder({ color2 })}
                />
              )}
            </div>

            <Field label={t('posts.decoration.background')}>
              <div className="join flex w-full flex-wrap">
                {POST_BACKGROUND_TYPES.map((type: PostBackgroundType) => (
                  <button
                    key={type}
                    type="button"
                    className={
                      background.type === type
                        ? 'join-item btn btn-primary btn-sm flex-1'
                        : 'join-item btn btn-outline btn-sm flex-1'
                    }
                    aria-pressed={background.type === type}
                    disabled={locked}
                    onClick={() =>
                      setBackground({
                        type,
                        opacity:
                          type === 'image' || type === 'pattern'
                            ? Math.min(background.opacity, 40)
                            : background.opacity,
                      })
                    }
                  >
                    {t(`posts.decoration.backgroundTypes.${type}`)}
                  </button>
                ))}
              </div>
            </Field>

            {background.type === 'color' && (
              <ColorInput
                label={t('posts.decoration.color')}
                value={background.color}
                disabled={locked}
                onChange={(color) => setBackground({ color })}
              />
            )}

            {background.type === 'pattern' && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {POST_BACKGROUND_PATTERNS.map((pattern: PostBackgroundPattern) => (
                    <button
                      key={pattern}
                      type="button"
                      disabled={locked}
                      aria-pressed={background.pattern === pattern}
                      title={t(`posts.decoration.patterns.${pattern}`)}
                      className={
                        background.pattern === pattern
                          ? 'surface flex flex-col items-center gap-1 p-1.5 text-xs ring-2 ring-primary'
                          : 'surface flex flex-col items-center gap-1 p-1.5 text-xs'
                      }
                      onClick={() => setBackground({ pattern })}
                    >
                      <span
                        className="block h-10 w-full rounded-box"
                        style={patternStyle(pattern, background.patternColor)}
                      />
                      {t(`posts.decoration.patterns.${pattern}`)}
                    </button>
                  ))}
                </div>
                <ColorInput
                  label={t('posts.decoration.patternColor')}
                  value={background.patternColor}
                  disabled={locked}
                  onChange={(patternColor) => setBackground({ patternColor })}
                />
              </div>
            )}

            {background.type === 'image' && (
              <div className="flex flex-col gap-2">
                {previewImage ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={previewImage}
                      alt=""
                      className="h-16 w-28 rounded-box object-cover"
                    />
                    <Button size="sm" appearance="ghost" onClick={removeImage}>
                      <X className="h-4 w-4" />
                      {t('posts.removeImage')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <Field
                      label={t('posts.decoration.imageLink')}
                      hint={t('posts.linkHint')}
                      error={linkError || undefined}
                    >
                      {(id) => (
                        <div className="join w-full">
                          <input
                            id={id}
                            type="url"
                            inputMode="url"
                            className="input join-item focus:input-primary w-full"
                            placeholder={t('posts.linkPlaceholder')}
                            value={linkValue}
                            disabled={locked}
                            onChange={(event) => {
                              setLinkValue(event.target.value);
                              setLinkError('');
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                addLink();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="join-item btn btn-outline"
                            disabled={locked || !linkValue.trim()}
                            onClick={addLink}
                          >
                            <Link2 className="h-4 w-4" />
                            {t('posts.addLinkButton')}
                          </button>
                        </div>
                      )}
                    </Field>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={POST_UPLOAD_TYPES.join(',')}
                      className="hidden"
                      onChange={(event) => chooseFile(event.target.files)}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        appearance="outline"
                        disabled={locked}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        {t('posts.upload')}
                      </Button>
                      <span className="text-xs text-base-content/60">
                        {t('posts.uploadHint')}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {background.type !== 'none' && (
              <label className="flex flex-col gap-1">
                <span className="flex justify-between text-xs">
                  <span>{t('posts.decoration.opacity')}</span>
                  <span className="text-base-content/60">{background.opacity}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  className="range range-primary range-sm w-full"
                  disabled={locked}
                  value={background.opacity}
                  onChange={(event) =>
                    setBackground({ opacity: Number(event.target.value) })
                  }
                />
              </label>
            )}
          </fieldset>
        </div>
      )}
    </div>
  );
}
